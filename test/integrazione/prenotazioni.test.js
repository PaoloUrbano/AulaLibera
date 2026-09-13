const supertest = require('supertest');

const Occupazione = require('../../src/modelli/Occupazione');
const ambiente = require('./ambiente');

const richiesta = supertest(ambiente.creaApplicazione());

let studente;
let docente;
let amministratore;
let aulaStudio;

beforeAll(ambiente.avviaAmbiente);
afterAll(ambiente.chiudiAmbiente);

beforeEach(async () => {
  await ambiente.svuotaDatabase();
  studente = await ambiente.creaUtente({
    ruolo: 'studente',
    email: 'studente@poliba.it'
  });
  docente = await ambiente.creaUtente({
    ruolo: 'docente',
    email: 'docente@poliba.it'
  });
  amministratore = await ambiente.creaUtente({
    ruolo: 'amministratore',
    email: 'amministratore@poliba.it'
  });
  aulaStudio = await ambiente.creaAula({ codice: 'A01', tipoAula: 'studio' });
});

function prenota(utente, risorsa, oraInizio, oraFine) {
  return richiesta
    .post('/api/prenotazioni')
    .set('Authorization', ambiente.autorizzazione(utente))
    .send({
      idRisorsa: String(risorsa._id),
      dataOraInizio: ambiente.domaniAlle(oraInizio).toISOString(),
      dataOraFine: ambiente.domaniAlle(oraFine).toISOString(),
      motivazione: 'Attività didattica'
    });
}

describe('Creazione di una prenotazione', () => {
  test('lo studente prenota un aula studio e ottiene lo stato richiesta', async () => {
    const risposta = await prenota(studente, aulaStudio, 9, 11);

    expect(risposta.status).toBe(201);
    expect(risposta.body.prenotazione.stato).toBe('richiesta');
  });

  test('la prenotazione occupa uno slot per ogni intervallo elementare coperto', async () => {
    await prenota(studente, aulaStudio, 9, 11);

    const occupazioni = await Occupazione.find({ risorsa: aulaStudio._id });
    expect(occupazioni).toHaveLength(4);
  });

  test('rifiuta con 403 la prenotazione di un aula didattica da parte di uno studente', async () => {
    const aulaDidattica = await ambiente.creaAula({
      codice: 'A02',
      tipoAula: 'didattica'
    });

    const risposta = await prenota(studente, aulaDidattica, 9, 11);
    expect(risposta.status).toBe(403);
  });

  test('rifiuta con 403 la prenotazione di un laboratorio da parte di uno studente non abilitato', async () => {
    const laboratorio = await ambiente.creaLaboratorio({
      codice: 'L01',
      richiedeAbilitazione: true
    });

    const risposta = await prenota(studente, laboratorio, 9, 11);
    expect(risposta.status).toBe(403);
  });

  test('rifiuta con 403 il tentativo di prenotazione dell amministratore', async () => {
    const risposta = await prenota(amministratore, aulaStudio, 9, 11);
    expect(risposta.status).toBe(403);
  });

  test('rifiuta con 400 un orario non allineato agli slot', async () => {
    const risposta = await richiesta
      .post('/api/prenotazioni')
      .set('Authorization', ambiente.autorizzazione(docente))
      .send({
        idRisorsa: String(aulaStudio._id),
        dataOraInizio: ambiente.domaniAlle(9, 15).toISOString(),
        dataOraFine: ambiente.domaniAlle(10, 15).toISOString()
      });

    expect(risposta.status).toBe(400);
  });

  test('rifiuta con 400 una prenotazione che eccede l orario di chiusura', async () => {
    const risposta = await prenota(docente, aulaStudio, 19, 21);
    expect(risposta.status).toBe(400);
  });

  test('rifiuta con 400 una durata inferiore alla durata minima della risorsa', async () => {
    const risposta = await richiesta
      .post('/api/prenotazioni')
      .set('Authorization', ambiente.autorizzazione(docente))
      .send({
        idRisorsa: String(aulaStudio._id),
        dataOraInizio: ambiente.domaniAlle(9).toISOString(),
        dataOraFine: ambiente.domaniAlle(9, 30).toISOString()
      });

    expect(risposta.status).toBe(400);
  });

  test('rifiuta con 403 la prenotazione di una risorsa disattivata', async () => {
    const aulaSpenta = await ambiente.creaAula({
      codice: 'A03',
      tipoAula: 'studio',
      attiva: false
    });

    const risposta = await prenota(docente, aulaSpenta, 9, 11);
    expect(risposta.status).toBe(403);
  });
});

describe('Sovrapposizione fra prenotazioni', () => {
  test('rifiuta con 409 una prenotazione che si sovrappone anche solo in parte', async () => {
    const prima = await prenota(studente, aulaStudio, 9, 11);
    expect(prima.status).toBe(201);

    const sovrapposta = await prenota(docente, aulaStudio, 10, 12);
    expect(sovrapposta.status).toBe(409);
  });

  test('consente una prenotazione adiacente che non condivide alcuno slot', async () => {
    await prenota(studente, aulaStudio, 9, 11);

    const adiacente = await prenota(docente, aulaStudio, 11, 13);
    expect(adiacente.status).toBe(201);
  });

  test('il tentativo respinto non lascia prenotazioni né slot residui', async () => {
    await prenota(studente, aulaStudio, 9, 11);
    await prenota(docente, aulaStudio, 10, 12);

    const occupazioni = await Occupazione.find({ risorsa: aulaStudio._id });
    expect(occupazioni).toHaveLength(4);

    const elenco = await richiesta
      .get('/api/prenotazioni')
      .set('Authorization', ambiente.autorizzazione(amministratore));
    expect(elenco.body.prenotazioni).toHaveLength(1);
  });

  test('la stessa fascia su risorse diverse è consentita', async () => {
    const altraAula = await ambiente.creaAula({ codice: 'A04', tipoAula: 'studio' });

    expect((await prenota(studente, aulaStudio, 9, 11)).status).toBe(201);
    expect((await prenota(docente, altraAula, 9, 11)).status).toBe(201);
  });
});

describe('Consultazione e annullamento', () => {
  test('ogni utente vede soltanto le proprie prenotazioni', async () => {
    await prenota(studente, aulaStudio, 9, 11);
    await prenota(docente, aulaStudio, 11, 13);

    const risposta = await richiesta
      .get('/api/prenotazioni/mie')
      .set('Authorization', ambiente.autorizzazione(studente));

    expect(risposta.body.prenotazioni).toHaveLength(1);
    expect(risposta.body.prenotazioni[0].risorsa.codice).toBe('A01');
  });

  test('rifiuta con 403 la consultazione di tutte le prenotazioni a un docente', async () => {
    const risposta = await richiesta
      .get('/api/prenotazioni')
      .set('Authorization', ambiente.autorizzazione(docente));

    expect(risposta.status).toBe(403);
  });

  test("l'annullamento libera gli slot e la fascia torna prenotabile", async () => {
    const creata = await prenota(studente, aulaStudio, 9, 11);

    const annullamento = await richiesta
      .patch(`/api/prenotazioni/${creata.body.prenotazione._id}/annullamento`)
      .set('Authorization', ambiente.autorizzazione(studente));

    expect(annullamento.status).toBe(200);
    expect(annullamento.body.prenotazione.stato).toBe('annullata');
    expect(await Occupazione.countDocuments({ risorsa: aulaStudio._id })).toBe(0);

    const nuova = await prenota(docente, aulaStudio, 9, 11);
    expect(nuova.status).toBe(201);
  });

  test('rifiuta con 403 l annullamento di una prenotazione altrui', async () => {
    const creata = await prenota(studente, aulaStudio, 9, 11);

    const risposta = await richiesta
      .patch(`/api/prenotazioni/${creata.body.prenotazione._id}/annullamento`)
      .set('Authorization', ambiente.autorizzazione(docente));

    expect(risposta.status).toBe(403);
  });

  test("l'amministratore può annullare qualsiasi prenotazione", async () => {
    const creata = await prenota(studente, aulaStudio, 9, 11);

    const risposta = await richiesta
      .patch(`/api/prenotazioni/${creata.body.prenotazione._id}/annullamento`)
      .set('Authorization', ambiente.autorizzazione(amministratore));

    expect(risposta.status).toBe(200);
  });

  test('rifiuta con 409 il secondo annullamento della stessa prenotazione', async () => {
    const creata = await prenota(studente, aulaStudio, 9, 11);
    const percorso = `/api/prenotazioni/${creata.body.prenotazione._id}/annullamento`;

    await richiesta
      .patch(percorso)
      .set('Authorization', ambiente.autorizzazione(studente));

    const secondo = await richiesta
      .patch(percorso)
      .set('Authorization', ambiente.autorizzazione(studente));

    expect(secondo.status).toBe(409);
  });

  test("solo l'amministratore può confermare una prenotazione", async () => {
    const creata = await prenota(studente, aulaStudio, 9, 11);
    const percorso = `/api/prenotazioni/${creata.body.prenotazione._id}/stato`;

    const tentativoStudente = await richiesta
      .patch(percorso)
      .set('Authorization', ambiente.autorizzazione(studente))
      .send({ stato: 'confermata' });
    expect(tentativoStudente.status).toBe(403);

    const conferma = await richiesta
      .patch(percorso)
      .set('Authorization', ambiente.autorizzazione(amministratore))
      .send({ stato: 'confermata' });
    expect(conferma.status).toBe(200);
    expect(conferma.body.prenotazione.stato).toBe('confermata');
  });

  test('rifiuta con 400 la conclusione di una prenotazione non ancora terminata', async () => {
    const creata = await prenota(studente, aulaStudio, 9, 11);

    const risposta = await richiesta
      .patch(`/api/prenotazioni/${creata.body.prenotazione._id}/stato`)
      .set('Authorization', ambiente.autorizzazione(amministratore))
      .send({ stato: 'conclusa' });

    expect(risposta.status).toBe(400);
  });
});
