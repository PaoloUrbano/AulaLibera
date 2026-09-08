// Il servizio è messo alla prova in isolamento: il modello Utente e il servizio di
// configurazione sono sostituiti da doppioni, così il test verifica soltanto le regole
// di registrazione e di accesso senza dipendere da un database.
jest.mock('../../src/modelli/Utente', () => ({
  exists: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  calcolaHashPassword: jest.fn()
}));

jest.mock('../../src/servizi/servizioConfigurazione', () => ({
  ottieniConfigurazione: jest.fn()
}));

const Utente = require('../../src/modelli/Utente');
const servizioConfigurazione = require('../../src/servizi/servizioConfigurazione');
const servizioAutenticazione = require('../../src/servizi/servizioAutenticazione');
const {
  ErroreValidazione,
  ErroreConflitto,
  ErroreAutenticazione
} = require('../../src/servizi/errori');

const datiValidi = {
  nome: 'Marco',
  cognome: 'Rossi',
  email: 'marco.rossi@poliba.it',
  password: 'password-lunga',
  ruolo: 'studente'
};

beforeEach(() => {
  jest.clearAllMocks();

  servizioConfigurazione.ottieniConfigurazione.mockResolvedValue({
    dominioEmailConsentito: '@poliba.it'
  });
  Utente.exists.mockResolvedValue(false);
  Utente.calcolaHashPassword.mockResolvedValue('hash-calcolato');
  Utente.create.mockImplementation(async (documento) => documento);
});

describe('Registrazione di un nuovo utente', () => {
  test('accetta una email del dominio consentito e memorizza solo l hash', async () => {
    const creato = await servizioAutenticazione.registra(datiValidi);

    expect(Utente.calcolaHashPassword).toHaveBeenCalledWith('password-lunga');
    expect(creato.passwordHash).toBe('hash-calcolato');
    expect(creato.password).toBeUndefined();
  });

  test('normalizza la email in minuscolo prima di salvarla', async () => {
    const creato = await servizioAutenticazione.registra({
      ...datiValidi,
      email: '  Marco.Rossi@Poliba.it  '
    });

    expect(creato.email).toBe('marco.rossi@poliba.it');
  });

  test('rifiuta una email che non appartiene al dominio consentito', async () => {
    await expect(
      servizioAutenticazione.registra({ ...datiValidi, email: 'marco@gmail.com' })
    ).rejects.toThrow(ErroreValidazione);

    expect(Utente.create).not.toHaveBeenCalled();
  });

  test('legge il dominio consentito dalla configurazione e non da una costante', async () => {
    servizioConfigurazione.ottieniConfigurazione.mockResolvedValue({
      dominioEmailConsentito: '@studenti.poliba.it'
    });

    await expect(servizioAutenticazione.registra(datiValidi)).rejects.toThrow(
      /@studenti.poliba.it/
    );
  });

  test('non consente di registrarsi con il ruolo di amministratore', async () => {
    await expect(
      servizioAutenticazione.registra({ ...datiValidi, ruolo: 'amministratore' })
    ).rejects.toThrow(ErroreValidazione);
  });

  test('rifiuta una password più corta della lunghezza minima', async () => {
    await expect(
      servizioAutenticazione.registra({ ...datiValidi, password: 'corta' })
    ).rejects.toThrow(/almeno 8 caratteri/);
  });

  test('rifiuta una email già registrata segnalando un conflitto', async () => {
    Utente.exists.mockResolvedValue(true);

    await expect(servizioAutenticazione.registra(datiValidi)).rejects.toThrow(
      ErroreConflitto
    );
  });
});

describe('Accesso al sistema', () => {
  function utenteMemorizzato(passwordCorretta) {
    return {
      _id: '65f0000000000000000000aa',
      ruolo: 'docente',
      email: 'marco.rossi@poliba.it',
      verificaPassword: jest.fn().mockResolvedValue(passwordCorretta)
    };
  }

  test('restituisce un token che contiene identificativo e ruolo', async () => {
    Utente.findOne.mockResolvedValue(utenteMemorizzato(true));

    const { token } = await servizioAutenticazione.accedi({
      email: 'marco.rossi@poliba.it',
      password: 'password-lunga'
    });

    const contenuto = servizioAutenticazione.verificaToken(token);
    expect(contenuto.id).toBe('65f0000000000000000000aa');
    expect(contenuto.ruolo).toBe('docente');
  });

  test('rifiuta una password errata', async () => {
    Utente.findOne.mockResolvedValue(utenteMemorizzato(false));

    await expect(
      servizioAutenticazione.accedi({
        email: 'marco.rossi@poliba.it',
        password: 'sbagliata'
      })
    ).rejects.toThrow(ErroreAutenticazione);
  });

  test('non rivela se la email esiste: il messaggio di errore è il medesimo', async () => {
    Utente.findOne.mockResolvedValue(null);
    const erroreUtenteAssente = await servizioAutenticazione
      .accedi({ email: 'ignoto@poliba.it', password: 'password-lunga' })
      .catch((errore) => errore.message);

    Utente.findOne.mockResolvedValue(utenteMemorizzato(false));
    const errorePasswordErrata = await servizioAutenticazione
      .accedi({ email: 'marco.rossi@poliba.it', password: 'sbagliata' })
      .catch((errore) => errore.message);

    expect(erroreUtenteAssente).toBe(errorePasswordErrata);
  });

  test('rifiuta un token manomesso', () => {
    expect(() => servizioAutenticazione.verificaToken('token.non.valido')).toThrow(
      ErroreAutenticazione
    );
  });
});
