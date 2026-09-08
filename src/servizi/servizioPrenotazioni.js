const Prenotazione = require('../modelli/Prenotazione');
const Occupazione = require('../modelli/Occupazione');
const servizioConfigurazione = require('./servizioConfigurazione');
const servizioRisorse = require('./servizioRisorse');
const tempo = require('./tempo');
const {
  ErroreValidazione,
  ErroreAutorizzazione,
  ErroreNonTrovato,
  ErroreConflitto
} = require('./errori');

// Codice di errore che MongoDB restituisce quando una scrittura viola un indice univoco.
const ERRORE_CHIAVE_DUPLICATA = 11000;

// Transizioni ammesse dalla macchina a stati della prenotazione. Gli stati terminali
// "annullata" e "conclusa" non compaiono come sorgente perché da essi non si esce.
const TRANSIZIONI_AMMESSE = {
  richiesta: ['confermata', 'annullata', 'conclusa'],
  confermata: ['conclusa', 'annullata'],
  annullata: [],
  conclusa: []
};

// ---------------------------------------------------------------------------
// VALIDAZIONE DELLE REGOLE DI DOMINIO SULL'INTERVALLO RICHIESTO
// ---------------------------------------------------------------------------

// Verifica tutti i vincoli temporali di una richiesta di prenotazione. È separata dalla
// creazione perché è logica pura sul tempo, verificabile con test di unità senza
// database, e perché rende esplicito quali sono i vincoli del dominio.
function verificaVincoliTemporali(dataOraInizio, dataOraFine, risorsa, configurazione) {
  if (Number.isNaN(dataOraInizio.getTime()) || Number.isNaN(dataOraFine.getTime())) {
    throw new ErroreValidazione('Le date indicate non sono valide');
  }

  if (dataOraFine <= dataOraInizio) {
    throw new ErroreValidazione(
      "L'istante di fine deve essere successivo a quello di inizio"
    );
  }

  if (!tempo.stessoGiorno(dataOraInizio, dataOraFine)) {
    throw new ErroreValidazione(
      'Una prenotazione deve iniziare e terminare nello stesso giorno'
    );
  }

  const durataSlot = configurazione.durataSlotMinuti;

  if (
    !tempo.eAllineatoAlloSlot(dataOraInizio, durataSlot) ||
    !tempo.eAllineatoAlloSlot(dataOraFine, durataSlot)
  ) {
    throw new ErroreValidazione(
      `Inizio e fine devono essere allineati a slot di ${durataSlot} minuti`
    );
  }

  const durata = tempo.durataInMinuti(dataOraInizio, dataOraFine);

  // Le durate minima e massima sono proprietà della risorsa, non del sistema.
  if (durata < risorsa.durataMinimaMinuti) {
    throw new ErroreValidazione(
      `La durata minima per questa risorsa è di ${risorsa.durataMinimaMinuti} minuti`
    );
  }
  if (durata > risorsa.durataMassimaMinuti) {
    throw new ErroreValidazione(
      `La durata massima per questa risorsa è di ${risorsa.durataMassimaMinuti} minuti`
    );
  }

  const apertura = tempo.orarioInMinuti(configurazione.orarioApertura);
  const chiusura = tempo.orarioInMinuti(configurazione.orarioChiusura);

  if (
    tempo.minutiDaMezzanotte(dataOraInizio) < apertura ||
    tempo.minutiDaMezzanotte(dataOraFine) > chiusura
  ) {
    throw new ErroreValidazione(
      `La prenotazione deve essere compresa fra le ${configurazione.orarioApertura} e le ${configurazione.orarioChiusura}`
    );
  }

  const adesso = new Date();

  if (dataOraInizio < adesso) {
    throw new ErroreValidazione('Non è possibile prenotare un orario già trascorso');
  }

  const limiteAnticipo = new Date(adesso);
  limiteAnticipo.setDate(limiteAnticipo.getDate() + configurazione.anticipoMassimoGiorni);

  if (dataOraInizio > limiteAnticipo) {
    throw new ErroreValidazione(
      `Non è possibile prenotare con più di ${configurazione.anticipoMassimoGiorni} giorni di anticipo`
    );
  }
}

// ---------------------------------------------------------------------------
// CREAZIONE DELLA PRENOTAZIONE — MUTUA ESCLUSIONE SUGLI SLOT
// ---------------------------------------------------------------------------

// Requisito non funzionale critico: due utenti che richiedono la stessa risorsa nella
// stessa fascia oraria nello stesso istante non devono poter ottenere entrambi la
// prenotazione.
//
// PERCHÉ NON UN CONTROLLO find SEGUITO DA insert.
// La soluzione intuitiva — cercare le prenotazioni sovrapposte e, se non ce ne sono,
// inserire la nuova — contiene una corsa critica. Fra la lettura e la scrittura esiste
// una finestra temporale in cui un secondo processo può eseguire la propria lettura:
//
//   processo A: find -> nessuna sovrapposizione
//   processo B: find -> nessuna sovrapposizione   (A non ha ancora scritto)
//   processo A: insert -> riesce
//   processo B: insert -> riesce                  (doppia prenotazione)
//
// Nessun accorgimento applicativo elimina questa finestra, perché il controllo e la
// scrittura sono due operazioni distinte: la verifica risulta valida al momento in cui
// viene eseguita e obsoleta al momento in cui se ne usa il risultato. Servirebbe un
// vincolo di esclusione su intervalli temporali, che PostgreSQL offre con
// EXCLUDE USING gist e MongoDB non offre.
//
// COME È RISOLTA QUI.
// L'intervallo continuo viene discretizzato negli slot che lo compongono e ogni slot
// occupato diventa un documento della collezione Occupazione, che porta un indice
// univoco su (risorsa, slotInizio). L'unicità è così verificata dal motore del database
// all'atto della scrittura: controllo e scrittura diventano una sola operazione atomica.
// Due inserimenti concorrenti sullo stesso slot non possono riuscire entrambi, qualunque
// sia il loro ordine di arrivo; il secondo riceve l'errore di chiave duplicata 11000.
//
// La garanzia non dipende dunque dal codice applicativo ma da un vincolo di integrità:
// resta valida anche con più istanze del server in esecuzione contemporaneamente.
async function creaPrenotazione(utente, dati) {
  const { idRisorsa, dataOraInizio, dataOraFine, motivazione } = dati;

  const risorsa = await servizioRisorse.ottieniRisorsa(idRisorsa);

  // L'autorizzazione è verificata qui, nel livello di logica di business, e non solo
  // nell'interfaccia: è la regola di dominio sui ruoli e sulle abilitazioni.
  servizioRisorse.verificaPrenotabilita(utente, risorsa);

  const configurazione = await servizioConfigurazione.ottieniConfigurazione();

  const inizio = new Date(dataOraInizio);
  const fine = new Date(dataOraFine);

  verificaVincoliTemporali(inizio, fine, risorsa, configurazione);

  const slot = tempo.elencaSlot(inizio, fine, configurazione.durataSlotMinuti);

  // La prenotazione viene creata per prima perché ogni Occupazione deve riferirla.
  // Se l'occupazione degli slot fallisce la prenotazione viene rimossa: finché gli slot
  // non sono stati acquisiti la prenotazione non ha alcun effetto sul sistema.
  const prenotazione = await Prenotazione.create({
    risorsa: risorsa._id,
    utente: utente._id,
    dataOraInizio: inizio,
    dataOraFine: fine,
    motivazione,
    stato: 'richiesta'
  });

  const documentiOccupazione = slot.map((slotInizio) => ({
    risorsa: risorsa._id,
    slotInizio,
    prenotazione: prenotazione._id
  }));

  try {
    // ordered: true interrompe l'inserimento al primo slot già occupato, evitando di
    // acquisire slot che andrebbero comunque restituiti; gli slot eventualmente già
    // inseriti prima del conflitto vengono rimossi dalla pulizia sottostante.
    await Occupazione.insertMany(documentiOccupazione, { ordered: true });
  } catch (errore) {
    await annullaAcquisizioneSlot(prenotazione._id);

    if (errore.code === ERRORE_CHIAVE_DUPLICATA || errore.writeErrors) {
      throw new ErroreConflitto(
        'La risorsa risulta già prenotata in almeno uno degli slot richiesti'
      );
    }
    throw errore;
  }

  return prenotazione;
}

// Rimuove gli slot già acquisiti e la prenotazione: riporta il sistema allo stato
// precedente al tentativo. MongoDB non offre transazioni sulle repliche singole usate
// in sviluppo, quindi la compensazione è esplicita.
async function annullaAcquisizioneSlot(idPrenotazione) {
  await Occupazione.deleteMany({ prenotazione: idPrenotazione });
  await Prenotazione.deleteOne({ _id: idPrenotazione });
}

// ---------------------------------------------------------------------------
// CONSULTAZIONE
// ---------------------------------------------------------------------------

async function ottieniPrenotazione(idPrenotazione) {
  const prenotazione = await Prenotazione.findById(idPrenotazione);
  if (!prenotazione) {
    throw new ErroreNonTrovato('Prenotazione non trovata');
  }
  return prenotazione;
}

function costruisciFiltro({ stato, idRisorsa, giornoDa, giornoA }) {
  const filtro = {};

  if (stato) {
    filtro.stato = stato;
  }
  if (idRisorsa) {
    filtro.risorsa = idRisorsa;
  }
  if (giornoDa || giornoA) {
    filtro.dataOraInizio = {};
    if (giornoDa) {
      filtro.dataOraInizio.$gte = tempo.componiData(giornoDa, '00:00');
    }
    if (giornoA) {
      const giornoSuccessivo = tempo.componiData(giornoA, '00:00');
      giornoSuccessivo.setDate(giornoSuccessivo.getDate() + 1);
      filtro.dataOraInizio.$lt = giornoSuccessivo;
    }
  }

  return filtro;
}

async function elencaPrenotazioniUtente(idUtente, filtri = {}) {
  return Prenotazione.find({ ...costruisciFiltro(filtri), utente: idUtente })
    .sort({ dataOraInizio: -1 })
    .populate('risorsa', 'codice nome edificio piano tipoRisorsa tipoAula dipartimento');
}

// Vista dell'amministratore: tutte le prenotazioni, con l'indicazione di chi le ha fatte.
async function elencaTuttePrenotazioni(filtri = {}) {
  return Prenotazione.find(costruisciFiltro(filtri))
    .sort({ dataOraInizio: -1 })
    .populate('risorsa', 'codice nome edificio piano tipoRisorsa tipoAula dipartimento')
    .populate('utente', 'nome cognome email ruolo');
}

// ---------------------------------------------------------------------------
// CAMBIO DI STATO
// ---------------------------------------------------------------------------

// Unico punto in cui lo stato di una prenotazione cambia: le transizioni ammesse sono
// dichiarate in TRANSIZIONI_AMMESSE e corrispondono al diagramma di stato UML.
async function cambiaStato(idPrenotazione, nuovoStato, utenteRichiedente) {
  const prenotazione = await ottieniPrenotazione(idPrenotazione);

  const eAmministratore = utenteRichiedente.ruolo === 'amministratore';
  const eProprietario =
    String(prenotazione.utente) === String(utenteRichiedente._id);

  // L'annullamento spetta al titolare della prenotazione e all'amministratore; ogni
  // altra transizione spetta al solo amministratore.
  if (nuovoStato === 'annullata') {
    if (!eAmministratore && !eProprietario) {
      throw new ErroreAutorizzazione(
        'È possibile annullare soltanto le proprie prenotazioni'
      );
    }
  } else if (!eAmministratore) {
    throw new ErroreAutorizzazione(
      'Solo un amministratore può modificare lo stato di una prenotazione'
    );
  }

  if (!TRANSIZIONI_AMMESSE[prenotazione.stato].includes(nuovoStato)) {
    throw new ErroreConflitto(
      `Non è ammesso il passaggio dallo stato ${prenotazione.stato} allo stato ${nuovoStato}`
    );
  }

  if (nuovoStato === 'conclusa' && prenotazione.dataOraFine > new Date()) {
    throw new ErroreValidazione(
      'Una prenotazione può essere conclusa solo dopo il suo termine'
    );
  }

  // L'annullamento libera gli slot: è ciò che rende la risorsa nuovamente prenotabile
  // in quella fascia. Gli altri stati la mantengono occupata.
  if (nuovoStato === 'annullata') {
    await Occupazione.deleteMany({ prenotazione: prenotazione._id });
  }

  prenotazione.stato = nuovoStato;
  return prenotazione.save();
}

function annullaPrenotazione(idPrenotazione, utenteRichiedente) {
  return cambiaStato(idPrenotazione, 'annullata', utenteRichiedente);
}

module.exports = {
  ERRORE_CHIAVE_DUPLICATA,
  TRANSIZIONI_AMMESSE,
  verificaVincoliTemporali,
  creaPrenotazione,
  ottieniPrenotazione,
  elencaPrenotazioniUtente,
  elencaTuttePrenotazioni,
  cambiaStato,
  annullaPrenotazione
};
