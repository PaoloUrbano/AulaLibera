const supertest = require('supertest');

const ambiente = require('./ambiente');

const applicazione = ambiente.creaApplicazione();
const richiesta = supertest(applicazione);

beforeAll(ambiente.avviaAmbiente);
afterAll(ambiente.chiudiAmbiente);
beforeEach(ambiente.svuotaDatabase);

describe('Rotte di autenticazione', () => {
  test('registra un nuovo studente con email istituzionale', async () => {
    const risposta = await richiesta.post('/api/autenticazione/registrazione').send({
      nome: 'Anna',
      cognome: 'Bianchi',
      email: 'anna.bianchi@poliba.it',
      password: 'password-di-prova',
      ruolo: 'studente'
    });

    expect(risposta.status).toBe(201);
    expect(risposta.body.utente.email).toBe('anna.bianchi@poliba.it');
    // La risposta non deve mai contenere l'hash della password.
    expect(risposta.body.utente.passwordHash).toBeUndefined();
  });

  test('rifiuta con 400 una registrazione con email di dominio non consentito', async () => {
    const risposta = await richiesta.post('/api/autenticazione/registrazione').send({
      nome: 'Anna',
      cognome: 'Bianchi',
      email: 'anna.bianchi@gmail.com',
      password: 'password-di-prova',
      ruolo: 'studente'
    });

    expect(risposta.status).toBe(400);
  });

  test('rifiuta con 409 la registrazione di una email già presente', async () => {
    await ambiente.creaUtente({ ruolo: 'studente', email: 'anna@poliba.it' });

    const risposta = await richiesta.post('/api/autenticazione/registrazione').send({
      nome: 'Anna',
      cognome: 'Bianchi',
      email: 'anna@poliba.it',
      password: 'password-di-prova',
      ruolo: 'studente'
    });

    expect(risposta.status).toBe(409);
  });

  test('rilascia un token utilizzabile sulle rotte protette', async () => {
    await ambiente.creaUtente({ ruolo: 'docente', email: 'docente@poliba.it' });

    const accesso = await richiesta.post('/api/autenticazione/accesso').send({
      email: 'docente@poliba.it',
      password: 'password-di-prova'
    });

    expect(accesso.status).toBe(200);

    const profilo = await richiesta
      .get('/api/autenticazione/profilo')
      .set('Authorization', `Bearer ${accesso.body.token}`);

    expect(profilo.status).toBe(200);
    expect(profilo.body.utente.ruolo).toBe('docente');
  });

  test('rifiuta con 401 un accesso con password errata', async () => {
    await ambiente.creaUtente({ ruolo: 'docente', email: 'docente@poliba.it' });

    const risposta = await richiesta.post('/api/autenticazione/accesso').send({
      email: 'docente@poliba.it',
      password: 'password-sbagliata'
    });

    expect(risposta.status).toBe(401);
  });

  test('rifiuta con 401 una rotta protetta invocata senza token', async () => {
    const risposta = await richiesta.get('/api/risorse');
    expect(risposta.status).toBe(401);
  });

  test('rifiuta con 401 una rotta protetta invocata con token non valido', async () => {
    const risposta = await richiesta
      .get('/api/risorse')
      .set('Authorization', 'Bearer token-inventato');

    expect(risposta.status).toBe(401);
  });
});
