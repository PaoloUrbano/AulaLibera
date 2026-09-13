const supertest = require('supertest');

const ambiente = require('./ambiente');

const richiesta = supertest(ambiente.creaApplicazione());

let studente;
let docente;
let amministratore;

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
});

describe('Consultazione delle risorse filtrata dal ruolo', () => {
  test("allo studente non compaiono le aule didattiche né i laboratori a cui non è abilitato", async () => {
    await ambiente.creaAula({ codice: 'A01', tipoAula: 'studio' });
    await ambiente.creaAula({ codice: 'A02', tipoAula: 'didattica' });
    await ambiente.creaLaboratorio({ codice: 'L01', richiedeAbilitazione: true });
    await ambiente.creaLaboratorio({ codice: 'L02', richiedeAbilitazione: false });

    const risposta = await richiesta
      .get('/api/risorse')
      .set('Authorization', ambiente.autorizzazione(studente));

    const codici = risposta.body.risorse.map((risorsa) => risorsa.codice);
    expect(codici.sort()).toEqual(['A01', 'L02']);
  });

  test('al docente compaiono tutte le risorse attive', async () => {
    await ambiente.creaAula({ codice: 'A01', tipoAula: 'studio' });
    await ambiente.creaAula({ codice: 'A02', tipoAula: 'didattica' });
    await ambiente.creaLaboratorio({ codice: 'L01', richiedeAbilitazione: true });

    const risposta = await richiesta
      .get('/api/risorse')
      .set('Authorization', ambiente.autorizzazione(docente));

    expect(risposta.body.risorse).toHaveLength(3);
  });

  test('le risorse disattivate non compaiono agli utenti che prenotano', async () => {
    await ambiente.creaAula({ codice: 'A01', tipoAula: 'studio', attiva: false });

    const risposta = await richiesta
      .get('/api/risorse')
      .set('Authorization', ambiente.autorizzazione(docente));

    expect(risposta.body.risorse).toHaveLength(0);
  });

  test('il filtro per dipartimento restituisce i soli laboratori richiesti', async () => {
    await ambiente.creaLaboratorio({ codice: 'L01', dipartimento: 'DEI' });
    await ambiente.creaLaboratorio({ codice: 'L02', dipartimento: 'DMMM' });

    const risposta = await richiesta
      .get('/api/risorse?dipartimento=DMMM')
      .set('Authorization', ambiente.autorizzazione(docente));

    expect(risposta.body.risorse).toHaveLength(1);
    expect(risposta.body.risorse[0].codice).toBe('L02');
  });
});

describe('Gestione delle risorse riservata all amministratore', () => {
  test('crea un laboratorio conservando i campi della specializzazione', async () => {
    const risposta = await richiesta
      .post('/api/risorse')
      .set('Authorization', ambiente.autorizzazione(amministratore))
      .send({
        tipoRisorsa: 'Laboratorio',
        codice: 'LAB-DEI-01',
        nome: 'Automation and Robotics Lab',
        edificio: 'DEI',
        piano: 1,
        capienza: 25,
        dipartimento: 'DEI',
        numeroPostazioni: 25,
        softwareInstallato: ['MATLAB', 'ROS'],
        richiedeAbilitazione: true
      });

    expect(risposta.status).toBe(201);
    expect(risposta.body.risorsa.tipoRisorsa).toBe('Laboratorio');
    expect(risposta.body.risorsa.softwareInstallato).toEqual(['MATLAB', 'ROS']);
  });

  test('rifiuta con 409 la creazione di una risorsa con codice già esistente', async () => {
    await ambiente.creaAula({ codice: 'A01' });

    const risposta = await richiesta
      .post('/api/risorse')
      .set('Authorization', ambiente.autorizzazione(amministratore))
      .send({
        tipoRisorsa: 'Aula',
        codice: 'A01',
        nome: 'Doppione',
        edificio: 'Q',
        piano: 0,
        capienza: 10,
        tipoAula: 'studio'
      });

    expect(risposta.status).toBe(409);
  });

  test('modifica le durate minima e massima di una risorsa', async () => {
    const aula = await ambiente.creaAula({ codice: 'A01' });

    const risposta = await richiesta
      .put(`/api/risorse/${aula._id}`)
      .set('Authorization', ambiente.autorizzazione(amministratore))
      .send({ durataMinimaMinuti: 30, durataMassimaMinuti: 120 });

    expect(risposta.status).toBe(200);
    expect(risposta.body.risorsa.durataMinimaMinuti).toBe(30);
    expect(risposta.body.risorsa.durataMassimaMinuti).toBe(120);
  });

  test('disattiva una risorsa senza eliminarla', async () => {
    const aula = await ambiente.creaAula({ codice: 'A01' });

    const risposta = await richiesta
      .patch(`/api/risorse/${aula._id}/attivazione`)
      .set('Authorization', ambiente.autorizzazione(amministratore))
      .send({ attiva: false });

    expect(risposta.status).toBe(200);
    expect(risposta.body.risorsa.attiva).toBe(false);
  });

  // nascondere il pulsante non basta: la richiesta a mano va respinta dal backend
  test('rifiuta con 403 la creazione di una risorsa richiesta da uno studente', async () => {
    const risposta = await richiesta
      .post('/api/risorse')
      .set('Authorization', ambiente.autorizzazione(studente))
      .send({
        tipoRisorsa: 'Aula',
        codice: 'A99',
        nome: 'Aula abusiva',
        edificio: 'Q',
        piano: 0,
        capienza: 10,
        tipoAula: 'studio'
      });

    expect(risposta.status).toBe(403);
  });

  test('rifiuta con 403 la modifica della configurazione richiesta da un docente', async () => {
    const risposta = await richiesta
      .put('/api/configurazione')
      .set('Authorization', ambiente.autorizzazione(docente))
      .send({ durataSlotMinuti: 15 });

    expect(risposta.status).toBe(403);
  });

  test("l'amministratore aggiorna la configurazione globale", async () => {
    const risposta = await richiesta
      .put('/api/configurazione')
      .set('Authorization', ambiente.autorizzazione(amministratore))
      .send({ anticipoMassimoGiorni: 15, orarioChiusura: '22:00' });

    expect(risposta.status).toBe(200);
    expect(risposta.body.configurazione.anticipoMassimoGiorni).toBe(15);
    expect(risposta.body.configurazione.orarioChiusura).toBe('22:00');
  });
});

describe('Abilitazione degli studenti ai laboratori', () => {
  test("l'abilitazione rende visibile allo studente il laboratorio che la richiede", async () => {
    const laboratorio = await ambiente.creaLaboratorio({
      codice: 'L01',
      richiedeAbilitazione: true
    });

    const primaConsultazione = await richiesta
      .get('/api/risorse')
      .set('Authorization', ambiente.autorizzazione(studente));
    expect(primaConsultazione.body.risorse).toHaveLength(0);

    const abilitazione = await richiesta
      .put(`/api/risorse/abilitazioni/${studente._id}/${laboratorio._id}`)
      .set('Authorization', ambiente.autorizzazione(amministratore))
      .send({ abilitato: true });
    expect(abilitazione.status).toBe(200);

    const secondaConsultazione = await richiesta
      .get('/api/risorse')
      .set('Authorization', ambiente.autorizzazione(studente));
    expect(secondaConsultazione.body.risorse).toHaveLength(1);
  });

  test('la revoca dell abilitazione nasconde nuovamente il laboratorio', async () => {
    const laboratorio = await ambiente.creaLaboratorio({
      codice: 'L01',
      richiedeAbilitazione: true
    });

    await richiesta
      .put(`/api/risorse/abilitazioni/${studente._id}/${laboratorio._id}`)
      .set('Authorization', ambiente.autorizzazione(amministratore))
      .send({ abilitato: true });

    await richiesta
      .put(`/api/risorse/abilitazioni/${studente._id}/${laboratorio._id}`)
      .set('Authorization', ambiente.autorizzazione(amministratore))
      .send({ abilitato: false });

    const consultazione = await richiesta
      .get('/api/risorse')
      .set('Authorization', ambiente.autorizzazione(studente));

    expect(consultazione.body.risorse).toHaveLength(0);
  });

  test('rifiuta con 400 l abilitazione di un docente, che non ne ha bisogno', async () => {
    const laboratorio = await ambiente.creaLaboratorio({ codice: 'L01' });

    const risposta = await richiesta
      .put(`/api/risorse/abilitazioni/${docente._id}/${laboratorio._id}`)
      .set('Authorization', ambiente.autorizzazione(amministratore))
      .send({ abilitato: true });

    expect(risposta.status).toBe(400);
  });
});
