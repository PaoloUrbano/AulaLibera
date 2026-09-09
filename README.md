# AulaLibera

Portale per la prenotazione di aule e laboratori del Politecnico di Bari.
Progetto d'esame di **Ingegneria del Software** (Prof.ssa Marina Mongiello), svolto
individualmente.

---

## Indice

- [Architettura](#architettura)
- [Modello di dominio](#modello-di-dominio)
- [Requisito non funzionale: la concorrenza](#requisito-non-funzionale-la-concorrenza)
- [Avvio con Docker](#avvio-con-docker)
- [Avvio in locale](#avvio-in-locale)
- [Utenti di esempio](#utenti-di-esempio)
- [Endpoint](#endpoint)
- [Test](#test)
- [Struttura delle cartelle](#struttura-delle-cartelle)
- [Scelte tecniche](#scelte-tecniche)

---

## Architettura

L'applicazione è organizzata **a livelli**, e i livelli corrispondono alle cartelle:

| Livello | Cartella | Responsabilità |
|---|---|---|
| Interfaccia utente | `client/` | Applicazione React servita come file statici |
| Interfaccia (HTTP) | `src/rotte/`, `src/controllori/`, `src/middleware/` | Traduzione fra richieste HTTP e servizi, autenticazione e autorizzazione |
| Logica di business | `src/servizi/` | Regole di dominio: ruoli, abilitazioni, durate, orari, mutua esclusione |
| Gestione dati | `src/modelli/` | Schemi Mongoose e vincoli di integrità |

**Regola architetturale senza eccezioni:** i controllori non accedono mai direttamente ai
modelli, passano sempre dai servizi. I servizi non conoscono HTTP: segnalano i propri
fallimenti con errori di dominio (`src/servizi/errori.js`), che il gestore degli errori
traduce in codici di stato in un unico punto.

```
richiesta HTTP
      |
   rotte ------ verificaToken, verificaRuolo
      |
 controllori ---- traduzione HTTP <-> dominio
      |
  servizi --------- regole di dominio
      |
  modelli --------- schemi e vincoli
      |
   MongoDB
```

---

## Modello di dominio

- **Utente** — classe base con `ruolo` fra `studente`, `docente`, `amministratore`, e
  `abilitazioniLaboratori`, l'elenco dei laboratori a uso controllato che gli sono stati
  aperti dall'amministratore.
- **RisorsaPrenotabile** — classe base astratta, specializzata in **Aula** e
  **Laboratorio**. La generalizzazione è realizzata con il *discriminator* di Mongoose:
  una sola collezione, il campo `tipoRisorsa` indica la sottoclasse concreta.
- **Prenotazione** — con `stato` fra `richiesta`, `confermata`, `annullata`, `conclusa`.
  Le transizioni ammesse sono dichiarate in `TRANSIZIONI_AMMESSE` e corrispondono al
  diagramma di stato.
- **Occupazione** — entità tecnica che materializza gli slot temporali occupati.
- **Configurazione** — documento singleton con i parametri globali di sistema.

### Chi può prenotare che cosa

| Ruolo | Aule didattiche | Aule studio | Laboratori |
|---|---|---|---|
| Studente | no | sì | sì, se il laboratorio non richiede abilitazione o se è abilitato |
| Docente | sì | sì | sì, senza vincoli |
| Amministratore | non prenota: gestisce risorse, configurazione e abilitazioni, e può annullare qualsiasi prenotazione |

### Vincoli su ogni prenotazione

- durata compresa fra `durataMinimaMinuti` e `durataMassimaMinuti` **della risorsa**;
- inizio e fine allineati ai confini degli slot (`durataSlotMinuti`);
- interamente compresa fra `orarioApertura` e `orarioChiusura`, nello stesso giorno;
- non nel passato e non oltre `anticipoMassimoGiorni`;
- risorsa `attiva`;
- nessuna sovrapposizione con altre prenotazioni attive sulla stessa risorsa.

---

## Requisito non funzionale: la concorrenza

Due utenti che richiedono la stessa risorsa nella stessa fascia oraria nello stesso
istante non devono poter ottenere entrambi la prenotazione.

**Perché non basta controllare e poi scrivere.** La soluzione intuitiva — cercare le
prenotazioni sovrapposte e, se non ce ne sono, inserire la nuova — contiene una corsa
critica: fra la lettura e la scrittura esiste una finestra in cui un secondo processo
esegue la propria lettura e trova ancora la risorsa libera.

```
processo A: find   -> nessuna sovrapposizione
processo B: find   -> nessuna sovrapposizione   (A non ha ancora scritto)
processo A: insert -> riesce
processo B: insert -> riesce                    (doppia prenotazione)
```

Nessun accorgimento applicativo elimina la finestra, perché controllo e scrittura restano
due operazioni distinte. Servirebbe un vincolo di esclusione su intervalli temporali, che
PostgreSQL offre con `EXCLUDE USING gist` e MongoDB non offre.

**Come è risolta.** L'intervallo continuo viene discretizzato negli slot che lo compongono
e ogni slot occupato diventa un documento della collezione `Occupazione`, che porta un
**indice univoco composto su `(risorsa, slotInizio)`**:

1. creando una prenotazione di N slot il servizio inserisce N documenti `Occupazione` con
   `insertMany(..., { ordered: true })`;
2. se un altro utente ha già occupato anche uno solo di quegli slot, MongoDB solleva
   l'errore di chiave duplicata **11000**;
3. il servizio rimuove allora gli slot eventualmente già inseriti e la prenotazione, e
   restituisce un conflitto (**HTTP 409**).

La garanzia viene dall'indice univoco, applicato dal motore del database: controllo e
scrittura diventano una sola operazione atomica, e due inserimenti concorrenti sullo
stesso slot non possono riuscire entrambi qualunque sia il loro ordine di arrivo. La
proprietà resta valida anche con più istanze del server in esecuzione.

Il codice è in [`src/servizi/servizioPrenotazioni.js`](src/servizi/servizioPrenotazioni.js),
l'indice in [`src/modelli/Occupazione.js`](src/modelli/Occupazione.js), la verifica in
[`test/integrazione/concorrenza.test.js`](test/integrazione/concorrenza.test.js): dieci
richieste simultanee sullo stesso intervallo, esattamente una accolta e nove respinte
con 409.

---

## Avvio con Docker

```bash
docker compose up --build
```

L'applicazione risponde su <http://localhost:3000>. Il primo avvio costruisce il frontend
React e lo serve come file statico dallo stesso processo Node.

Per popolare il database con le risorse del Politecnico e gli utenti di esempio:

```bash
docker compose exec api node seed/popolaDatabase.js
```

Per fermare tutto conservando i dati:

```bash
docker compose down
```

---

## Avvio in locale

Servono Node.js 22 e un'istanza di MongoDB in ascolto su `localhost:27017`.

```bash
cp .env.esempio .env
npm install
npm run popola
npm run avvia
```

Il backend risponde sulla porta 3000. Per lavorare sul frontend con il ricaricamento
automatico, in un secondo terminale:

```bash
cd client
npm install
npm start
```

Il server di sviluppo di React occupa la porta 3001 e inoltra al backend le richieste
verso `/api` (campo `proxy` in `client/package.json`).

---

## Utenti di esempio

Creati da `npm run popola`. La password è la stessa per tutti: `password-di-prova`.

| Email | Ruolo | Note |
|---|---|---|
| `amministratore@poliba.it` | amministratore | Accede all'area di gestione, non prenota |
| `g.desantis@poliba.it` | docente | Prenota aule didattiche, aule studio e laboratori |
| `a.loiacono@poliba.it` | docente | |
| `l.ferrara@poliba.it` | studente | **Abilitato** al laboratorio `DEI-AROB` |
| `s.colella@poliba.it` | studente | Non abilitato ad alcun laboratorio |
| `d.rizzo@poliba.it` | studente | Non abilitato ad alcun laboratorio |

Accedendo con `l.ferrara` e con `s.colella` si osserva la differenza: il laboratorio
`DEI-AROB` compare al primo e non al secondo.

---

## Endpoint

Tutte le rotte, tranne registrazione e accesso, richiedono l'intestazione
`Authorization: Bearer <token>`.

### Autenticazione

| Metodo | Percorso | Ruoli | Descrizione |
|---|---|---|---|
| POST | `/api/autenticazione/registrazione` | pubblico | Registra uno studente o un docente; rifiuta le email fuori dal dominio consentito |
| POST | `/api/autenticazione/accesso` | pubblico | Rilascia il token JWT |
| POST | `/api/autenticazione/disconnessione` | autenticati | Il client scarta il token |
| GET | `/api/autenticazione/profilo` | autenticati | Utente corrente con ruolo e abilitazioni |

### Risorse

| Metodo | Percorso | Ruoli | Descrizione |
|---|---|---|---|
| GET | `/api/risorse` | autenticati | Elenco filtrato per ruolo. Parametri: `tipoRisorsa`, `tipoAula`, `dipartimento`, `giorno`, `oraInizio`, `oraFine`, `includiDisattivate` |
| GET | `/api/risorse/:id` | autenticati | Dettaglio |
| GET | `/api/risorse/:id/disponibilita?giorno=AAAA-MM-GG` | autenticati | Slot già occupati nella giornata |
| POST | `/api/risorse` | amministratore | Crea un'aula o un laboratorio |
| PUT | `/api/risorse/:id` | amministratore | Modifica, durate comprese |
| PATCH | `/api/risorse/:id/attivazione` | amministratore | Attiva o disattiva |
| DELETE | `/api/risorse/:id` | amministratore | Elimina, solo se priva di occupazioni |
| GET | `/api/risorse/abilitazioni/studenti` | amministratore | Studenti con le rispettive abilitazioni |
| PUT | `/api/risorse/abilitazioni/:idStudente/:idLaboratorio` | amministratore | Concede o revoca un'abilitazione |

### Prenotazioni

| Metodo | Percorso | Ruoli | Descrizione |
|---|---|---|---|
| POST | `/api/prenotazioni` | studente, docente | Crea una prenotazione; **409** se la fascia è già occupata |
| GET | `/api/prenotazioni/mie` | autenticati | Le proprie prenotazioni |
| GET | `/api/prenotazioni` | amministratore | Tutte le prenotazioni. Parametri: `stato`, `idRisorsa`, `giornoDa`, `giornoA` |
| PATCH | `/api/prenotazioni/:id/annullamento` | titolare o amministratore | Annulla e libera gli slot |
| PATCH | `/api/prenotazioni/:id/stato` | amministratore | Altre transizioni di stato |

### Configurazione

| Metodo | Percorso | Ruoli | Descrizione |
|---|---|---|---|
| GET | `/api/configurazione` | autenticati | Il client ne ha bisogno per proporre orari validi |
| PUT | `/api/configurazione` | amministratore | Modifica i parametri globali |

### Codici di stato

| Codice | Significato |
|---|---|
| 400 | Dati non validi o regola di dominio violata |
| 401 | Token assente, scaduto o non valido |
| 403 | Ruolo non sufficiente, o risorsa non prenotabile da quel ruolo |
| 404 | Entità inesistente |
| 409 | Conflitto: fascia già occupata, codice già esistente, transizione di stato non ammessa |

---

## Test

```bash
npm test                  # tutta la suite
npm run test:unita        # servizi in isolamento, modelli sostituiti da doppioni
npm run test:integrazione # rotte su MongoDB in memoria, incluso il test di concorrenza
npm run test:copertura    # con il rapporto di copertura
```

La suite conta 105 test e copre il 91% delle istruzioni di `src/`.

I test di integrazione usano `mongodb-memory-server`: non serve un MongoDB installato, ma
il primo avvio scarica il binario di MongoDB.

| File | Che cosa verifica |
|---|---|
| `test/unita/tempo.test.js` | Allineamento agli slot, durate, enumerazione degli slot |
| `test/unita/vincoliPrenotazione.test.js` | Durate della risorsa, orari di apertura, finestra di prenotabilità |
| `test/unita/permessiRisorse.test.js` | Permessi per ruolo e abilitazione ai laboratori |
| `test/unita/servizioAutenticazione.test.js` | Dominio email, ruoli registrabili, hashing, contenuto del token |
| `test/unita/acquisizioneSlot.test.js` | Acquisizione degli slot e compensazione in caso di conflitto |
| `test/integrazione/autenticazione.test.js` | Registrazione, accesso, protezione delle rotte |
| `test/integrazione/risorse.test.js` | Filtro per ruolo, gestione, abilitazioni |
| `test/integrazione/prenotazioni.test.js` | Regole di prenotazione, sovrapposizioni, annullamento |
| `test/integrazione/disponibilita.test.js` | Slot occupati, filtro per fascia oraria, eliminazione di una risorsa prenotata |
| `test/integrazione/concorrenza.test.js` | **Mutua esclusione con dieci richieste simultanee** |

---

## Struttura delle cartelle

```
aula-libera/
├── server.js                    avvio, connessione al DB, montaggio delle rotte
├── Dockerfile                   build in due stadi: frontend, poi immagine finale
├── docker-compose.yml           servizio api e servizio db
├── .env.esempio                 template senza segreti
│
├── src/
│   ├── modelli/                 LIVELLO DATI
│   │   ├── Utente.js
│   │   ├── RisorsaPrenotabile.js    base + discriminator Aula e Laboratorio
│   │   ├── Prenotazione.js
│   │   ├── Occupazione.js           indice univoco (risorsa, slotInizio)
│   │   └── Configurazione.js
│   │
│   ├── servizi/                 LIVELLO LOGICA DI BUSINESS
│   │   ├── servizioAutenticazione.js
│   │   ├── servizioRisorse.js
│   │   ├── servizioPrenotazioni.js  logica di concorrenza
│   │   ├── servizioConfigurazione.js
│   │   ├── tempo.js                 funzioni pure sul tempo
│   │   └── errori.js                errori di dominio
│   │
│   ├── controllori/             LIVELLO INTERFACCIA
│   ├── rotte/
│   └── middleware/              verificaToken, verificaRuolo, gestoreErrori
│
├── test/
│   ├── unita/
│   └── integrazione/
│
├── seed/
│   └── popolaDatabase.js        risorse reali del Poliba e utenti di esempio
│
└── client/
    └── src/
        ├── App.js
        ├── formato.js           formattazione di durate e orari
        ├── componenti/          fra cui MappaSlot, la griglia della giornata
        ├── pagine/
        ├── contesti/            contesto di autenticazione
        └── servizi/             chiamate HTTP verso il backend
```

Due moduli non compaiono nella traccia iniziale e sono stati aggiunti con una ragione
precisa: `src/servizi/tempo.js` raccoglie le funzioni pure sul tempo usate da più servizi,
così da poterle verificare con test diretti; `src/servizi/errori.js` definisce il
vocabolario di errori del dominio, che è ciò che consente ai servizi di ignorare HTTP.

---

## Scelte tecniche

### Frontend

Una sola applicazione React per tutti i ruoli, non applicazioni separate. Studente e
docente condividono la **stessa pagina di prenotazione**: a cambiare è l'elenco delle
risorse, che il backend restituisce già filtrato. L'amministratore raggiunge una sezione
di gestione dedicata, il cui collegamento compare solo a lui.

**La scelta della fascia oraria avviene su una mappa**, non su due menù a tendina: la
giornata è disegnata come una griglia di caselle da `durataSlotMinuti` ciascuna, e lo
stato di ognuna (libera, già prenotata, trascorsa, incompatibile con le durate della
risorsa) si legge a colpo d'occhio. Il primo clic seleziona subito il numero minimo di
caselle ammesso dalla risorsa, un secondo clic estende la selezione, e le caselle che non
possono chiudere una prenotazione valida vengono attenuate. Così la granularità dello
slot e la durata minima restano due grandezze distinte e visibili, mentre esprimerle solo
a parole le faceva confondere.

**Nascondere un pulsante non è autorizzazione.** Il frontend evita di mostrare comandi che
verrebbero comunque rifiutati: è usabilità. L'autorizzazione è quella applicata da
`verificaRuolo` sul backend, che respinge ogni richiesta non consentita anche se costruita
a mano. I test `rifiuta con 403 la creazione di una risorsa richiesta da uno studente` e
`rifiuta con 403 il tentativo di prenotazione dell amministratore` verificano proprio
questo.

### Dipendenze

| Dipendenza | Ruolo | Perché è necessaria |
|---|---|---|
| `express` | Server HTTP | Instradamento e middleware; è il riferimento dell'ecosistema Node |
| `mongoose` | Accesso a MongoDB | Schemi, validazione, indici dichiarativi e *discriminator*, che è la traduzione diretta della generalizzazione UML |
| `bcryptjs` | Hashing delle password | Implementazione di bcrypt in JavaScript puro: stesso algoritmo del pacchetto `bcrypt` senza estensioni native da compilare, quindi installazione riproducibile su Windows e nell'immagine `node:22-slim` |
| `jsonwebtoken` | Token JWT | Firma e verifica; scrivere a mano firma e validazione sarebbe un rischio di sicurezza inutile |
| `dotenv` | Configurazione | Legge il file `.env` in sviluppo; in Docker le variabili arrivano da `docker-compose.yml` |
| `react`, `react-dom` | Interfaccia utente | Richiesti dalla traccia |
| `react-router-dom` | Navigazione | Rotte protette per ruolo e navigazione senza ricaricamento |
| `react-scripts` | Compilazione del frontend | Toolchain di Create React App, indicata dalla traccia |
| `jest` (sviluppo) | Test | Esecutore e libreria di asserzioni, con supporto ai doppioni per i test di unità |
| `supertest` (sviluppo) | Test di integrazione | Invia richieste HTTP all'applicazione Express senza aprire una porta |
| `mongodb-memory-server` (sviluppo) | Test di integrazione | Un vero MongoDB in memoria: senza di esso gli indici, e quindi il requisito di concorrenza, non sarebbero verificabili |

Non sono state introdotte librerie per la validazione, per la gestione dello stato o per
la grafica: le regole di dominio sono espresse nei servizi, dove devono poter essere
lette e discusse, e l'interfaccia usa CSS scritto a mano.

### Scelte di modellazione

| Scelta | Alternativa scartata | Motivo |
|---|---|---|
| Discriminator per Aula e Laboratorio | Due collezioni separate | Le due specializzazioni condividono attributi e sono entrambe prenotabili: una sola collezione permette di interrogarle insieme e riproduce la generalizzazione UML |
| `stato` come enum | Collezione degli stati | Quattro valori fissi: una collezione aggiungerebbe una join senza aggiungere informazione |
| `softwareInstallato` come array di stringhe | Collezione dei software | I nomi non hanno identità propria nel dominio e non sono referenziati altrove |
| `Occupazione` separata da `Prenotazione` | Controllo di sovrapposizione sulle date | È ciò che rende la mutua esclusione un vincolo del database anziché un controllo applicativo soggetto a corsa critica |
| Compensazione esplicita in caso di conflitto | Transazione | Le transazioni di MongoDB richiedono un *replica set*; la compensazione funziona anche sull'istanza singola usata in sviluppo |
| Utente ricaricato dal database a ogni richiesta | Ruolo letto dal token | Ruolo e abilitazioni possono cambiare dopo l'emissione del token: fidarsi del suo contenuto significherebbe applicare permessi obsoleti |
