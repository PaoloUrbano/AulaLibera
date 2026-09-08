const mongoose = require('mongoose');
const supertest = require('supertest');

const Prenotazione = require('../../src/modelli/Prenotazione');
const Occupazione = require('../../src/modelli/Occupazione');
const ambiente = require('./ambiente');

const richiesta = supertest(ambiente.creaApplicazione());

// Numero di richieste lanciate contemporaneamente sulla stessa risorsa e sullo stesso
// intervallo. Deve essere ampiamente maggiore di uno perché la corsa sia significativa.
const RICHIESTE_SIMULTANEE = 10;

let aulaStudio;
let utenti;

beforeAll(ambiente.avviaAmbiente);
afterAll(ambiente.chiudiAmbiente);

beforeEach(async () => {
  await ambiente.svuotaDatabase();

  aulaStudio = await ambiente.creaAula({ codice: 'A01', tipoAula: 'studio' });

  // Utenti distinti: la corsa deve avvenire fra persone diverse, come nello scenario
  // reale di due studenti che chiedono la stessa aula nello stesso momento.
  utenti = await Promise.all(
    Array.from({ length: RICHIESTE_SIMULTANEE }, (nonUsato, indice) =>
      ambiente.creaUtente({
        ruolo: 'studente',
        email: `studente${indice}@poliba.it`
      })
    )
  );
});

function richiediPrenotazione(utente, oraInizio, oraFine) {
  return richiesta
    .post('/api/prenotazioni')
    .set('Authorization', ambiente.autorizzazione(utente))
    .send({
      idRisorsa: String(aulaStudio._id),
      dataOraInizio: ambiente.domaniAlle(oraInizio).toISOString(),
      dataOraFine: ambiente.domaniAlle(oraFine).toISOString(),
      motivazione: 'Studio individuale'
    });
}

function conta(risposte, codice) {
  return risposte.filter((risposta) => risposta.status === codice).length;
}

describe('Requisito non funzionale: mutua esclusione in presenza di richieste concorrenti', () => {
  test("l'indice univoco su (risorsa, slotInizio) esiste sulla collezione delle occupazioni", async () => {
    const indici = await mongoose.connection
      .collection('occupaziones')
      .indexes();

    const indiceDiEsclusione = indici.find(
      (indice) => indice.key.risorsa === 1 && indice.key.slotInizio === 1
    );

    // È questo vincolo, e non il codice applicativo, a garantire il requisito.
    expect(indiceDiEsclusione).toBeDefined();
    expect(indiceDiEsclusione.unique).toBe(true);
  });

  test('fra dieci richieste simultanee sullo stesso intervallo ne riesce esattamente una', async () => {
    const risposte = await Promise.all(
      utenti.map((utente) => richiediPrenotazione(utente, 9, 11))
    );

    expect(conta(risposte, 201)).toBe(1);
    expect(conta(risposte, 409)).toBe(RICHIESTE_SIMULTANEE - 1);
  });

  test('dopo la corsa resta una sola prenotazione e i soli slot che le competono', async () => {
    await Promise.all(utenti.map((utente) => richiediPrenotazione(utente, 9, 11)));

    // Le richieste perdenti compensano: nessuna prenotazione orfana, nessuno slot
    // trattenuto da un tentativo fallito.
    expect(await Prenotazione.countDocuments()).toBe(1);
    expect(await Occupazione.countDocuments()).toBe(4);
  });

  test('gli slot rimasti appartengono tutti alla prenotazione sopravvissuta', async () => {
    await Promise.all(utenti.map((utente) => richiediPrenotazione(utente, 9, 11)));

    const prenotazione = await Prenotazione.findOne();
    const occupazioni = await Occupazione.find();

    expect(
      occupazioni.every(
        (occupazione) =>
          String(occupazione.prenotazione) === String(prenotazione._id)
      )
    ).toBe(true);
  });

  test('la mutua esclusione vale anche per intervalli diversi ma sovrapposti', async () => {
    // Fasce sfalsate che condividono lo slot delle 10:00: solo la prima a scrivere
    // quello slot può riuscire.
    const risposte = await Promise.all([
      richiediPrenotazione(utenti[0], 9, 11),
      richiediPrenotazione(utenti[1], 10, 12),
      richiediPrenotazione(utenti[2], 8, 11)
    ]);

    expect(conta(risposte, 201)).toBe(1);
    expect(conta(risposte, 409)).toBe(2);
  });

  test('richieste simultanee su fasce disgiunte riescono tutte', async () => {
    const risposte = await Promise.all([
      richiediPrenotazione(utenti[0], 9, 11),
      richiediPrenotazione(utenti[1], 11, 13),
      richiediPrenotazione(utenti[2], 13, 15)
    ]);

    expect(conta(risposte, 201)).toBe(3);
  });
});
