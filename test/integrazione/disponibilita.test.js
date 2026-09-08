const supertest = require('supertest');

const ambiente = require('./ambiente');

const richiesta = supertest(ambiente.creaApplicazione());

let studente;
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
  amministratore = await ambiente.creaUtente({
    ruolo: 'amministratore',
    email: 'amministratore@poliba.it'
  });
  aulaStudio = await ambiente.creaAula({ codice: 'A01', tipoAula: 'studio' });
});

function prenota(risorsa, oraInizio, oraFine) {
  return richiesta
    .post('/api/prenotazioni')
    .set('Authorization', ambiente.autorizzazione(studente))
    .send({
      idRisorsa: String(risorsa._id),
      dataOraInizio: ambiente.domaniAlle(oraInizio).toISOString(),
      dataOraFine: ambiente.domaniAlle(oraFine).toISOString()
    });
}

describe('Disponibilità di una risorsa', () => {
  test('la giornata libera non presenta alcuno slot occupato', async () => {
    const risposta = await richiesta
      .get(`/api/risorse/${aulaStudio._id}/disponibilita`)
      .query({ giorno: ambiente.giornoDomani() })
      .set('Authorization', ambiente.autorizzazione(studente));

    expect(risposta.status).toBe(200);
    expect(risposta.body.slot).toHaveLength(0);
    expect(risposta.body.durataSlotMinuti).toBe(30);
  });

  test('dopo una prenotazione compaiono gli slot che essa occupa', async () => {
    await prenota(aulaStudio, 9, 11);

    const risposta = await richiesta
      .get(`/api/risorse/${aulaStudio._id}/disponibilita`)
      .query({ giorno: ambiente.giornoDomani() })
      .set('Authorization', ambiente.autorizzazione(studente));

    expect(risposta.body.slot).toHaveLength(4);
    expect(new Date(risposta.body.slot[0])).toEqual(ambiente.domaniAlle(9));
  });
});

describe('Filtro delle risorse per fascia oraria', () => {
  test('la risorsa occupata non compare fra quelle libere in quella fascia', async () => {
    await prenota(aulaStudio, 9, 11);

    const risposta = await richiesta
      .get('/api/risorse')
      .query({
        giorno: ambiente.giornoDomani(),
        oraInizio: '10:00',
        oraFine: '11:00'
      })
      .set('Authorization', ambiente.autorizzazione(studente));

    expect(risposta.body.risorse).toHaveLength(0);
  });

  test('la stessa risorsa compare in una fascia che non è occupata', async () => {
    await prenota(aulaStudio, 9, 11);

    const risposta = await richiesta
      .get('/api/risorse')
      .query({
        giorno: ambiente.giornoDomani(),
        oraInizio: '11:00',
        oraFine: '13:00'
      })
      .set('Authorization', ambiente.autorizzazione(studente));

    expect(risposta.body.risorse).toHaveLength(1);
  });

  test('rifiuta con 400 una fascia con fine precedente all inizio', async () => {
    const risposta = await richiesta
      .get('/api/risorse')
      .query({
        giorno: ambiente.giornoDomani(),
        oraInizio: '12:00',
        oraFine: '10:00'
      })
      .set('Authorization', ambiente.autorizzazione(studente));

    expect(risposta.status).toBe(400);
  });
});

describe('Eliminazione di una risorsa prenotata', () => {
  test('rifiuta con 409 e suggerisce la disattivazione', async () => {
    await prenota(aulaStudio, 9, 11);

    const risposta = await richiesta
      .delete(`/api/risorse/${aulaStudio._id}`)
      .set('Authorization', ambiente.autorizzazione(amministratore));

    expect(risposta.status).toBe(409);
    expect(risposta.body.errore).toMatch(/disattivarla/);
  });

  test('consente di eliminare una risorsa priva di prenotazioni', async () => {
    const risposta = await richiesta
      .delete(`/api/risorse/${aulaStudio._id}`)
      .set('Authorization', ambiente.autorizzazione(amministratore));

    expect(risposta.status).toBe(204);
  });

  test('risponde 404 sul dettaglio di una risorsa inesistente', async () => {
    const risposta = await richiesta
      .get('/api/risorse/650000000000000000000000')
      .set('Authorization', ambiente.autorizzazione(studente));

    expect(risposta.status).toBe(404);
  });
});

describe('Lettura della configurazione', () => {
  test('è consentita a chi prenota, perché il client deve proporre orari validi', async () => {
    const risposta = await richiesta
      .get('/api/configurazione')
      .set('Authorization', ambiente.autorizzazione(studente));

    expect(risposta.status).toBe(200);
    expect(risposta.body.configurazione.orarioApertura).toBe('08:00');
  });

  test('un endpoint inesistente sotto /api risponde 404', async () => {
    const risposta = await richiesta
      .get('/api/inesistente')
      .set('Authorization', ambiente.autorizzazione(studente));

    expect(risposta.status).toBe(404);
  });
});
