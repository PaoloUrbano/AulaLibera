// Verifica in isolamento il meccanismo di acquisizione degli slot: i modelli sono
// sostituiti da doppioni, così è possibile simulare l'errore di chiave duplicata che
// MongoDB solleverebbe in caso di conflitto e osservare la compensazione.
jest.mock('../../src/modelli/Prenotazione', () => ({
  create: jest.fn(),
  deleteOne: jest.fn()
}));

jest.mock('../../src/modelli/Occupazione', () => ({
  insertMany: jest.fn(),
  deleteMany: jest.fn()
}));

jest.mock('../../src/servizi/servizioRisorse', () => ({
  ottieniRisorsa: jest.fn(),
  verificaPrenotabilita: jest.fn()
}));

jest.mock('../../src/servizi/servizioConfigurazione', () => ({
  ottieniConfigurazione: jest.fn()
}));

const Prenotazione = require('../../src/modelli/Prenotazione');
const Occupazione = require('../../src/modelli/Occupazione');
const servizioRisorse = require('../../src/servizi/servizioRisorse');
const servizioConfigurazione = require('../../src/servizi/servizioConfigurazione');
const servizioPrenotazioni = require('../../src/servizi/servizioPrenotazioni');
const {
  ErroreConflitto,
  ErroreAutorizzazione
} = require('../../src/servizi/errori');

const IDENTIFICATIVO_RISORSA = 'risorsa-1';
const IDENTIFICATIVO_PRENOTAZIONE = 'prenotazione-1';

const utente = { _id: 'utente-1', ruolo: 'docente' };

function domaniAlle(ore, minuti = 0) {
  const istante = new Date();
  istante.setDate(istante.getDate() + 1);
  istante.setHours(ore, minuti, 0, 0);
  return istante;
}

function richiestaDiDueOre() {
  return {
    idRisorsa: IDENTIFICATIVO_RISORSA,
    dataOraInizio: domaniAlle(9),
    dataOraFine: domaniAlle(11),
    motivazione: 'Esercitazione'
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  servizioRisorse.ottieniRisorsa.mockResolvedValue({
    _id: IDENTIFICATIVO_RISORSA,
    attiva: true,
    durataMinimaMinuti: 60,
    durataMassimaMinuti: 240
  });
  servizioRisorse.verificaPrenotabilita.mockReturnValue(undefined);

  servizioConfigurazione.ottieniConfigurazione.mockResolvedValue({
    durataSlotMinuti: 30,
    anticipoMassimoGiorni: 30,
    orarioApertura: '08:00',
    orarioChiusura: '20:00'
  });

  Prenotazione.create.mockResolvedValue({ _id: IDENTIFICATIVO_PRENOTAZIONE });
  Prenotazione.deleteOne.mockResolvedValue({ deletedCount: 1 });
  Occupazione.insertMany.mockResolvedValue([]);
  Occupazione.deleteMany.mockResolvedValue({ deletedCount: 0 });
});

describe('Acquisizione degli slot alla creazione di una prenotazione', () => {
  test('inserisce un documento Occupazione per ogni slot coperto', async () => {
    await servizioPrenotazioni.creaPrenotazione(utente, richiestaDiDueOre());

    const [documenti, opzioni] = Occupazione.insertMany.mock.calls[0];

    // Due ore con slot da trenta minuti corrispondono a quattro slot.
    expect(documenti).toHaveLength(4);
    expect(documenti[0].slotInizio).toEqual(domaniAlle(9));
    expect(documenti[3].slotInizio).toEqual(domaniAlle(10, 30));
    expect(documenti.every((documento) => documento.risorsa === IDENTIFICATIVO_RISORSA)).toBe(
      true
    );
    expect(opzioni).toEqual({ ordered: true });
  });

  test('ogni occupazione riferisce la prenotazione che la ha generata', async () => {
    await servizioPrenotazioni.creaPrenotazione(utente, richiestaDiDueOre());

    const [documenti] = Occupazione.insertMany.mock.calls[0];
    expect(
      documenti.every(
        (documento) => documento.prenotazione === IDENTIFICATIVO_PRENOTAZIONE
      )
    ).toBe(true);
  });

  test('traduce l errore di chiave duplicata in un conflitto di dominio', async () => {
    const erroreMongo = Object.assign(new Error('E11000 duplicate key error'), {
      code: 11000
    });
    Occupazione.insertMany.mockRejectedValue(erroreMongo);

    await expect(
      servizioPrenotazioni.creaPrenotazione(utente, richiestaDiDueOre())
    ).rejects.toThrow(ErroreConflitto);
  });

  test('in caso di conflitto rimuove gli slot acquisiti e la prenotazione', async () => {
    Occupazione.insertMany.mockRejectedValue(
      Object.assign(new Error('E11000'), { code: 11000 })
    );

    await servizioPrenotazioni
      .creaPrenotazione(utente, richiestaDiDueOre())
      .catch(() => undefined);

    // La compensazione riporta il sistema allo stato precedente al tentativo: nessuno
    // slot trattenuto e nessuna prenotazione orfana.
    expect(Occupazione.deleteMany).toHaveBeenCalledWith({
      prenotazione: IDENTIFICATIVO_PRENOTAZIONE
    });
    expect(Prenotazione.deleteOne).toHaveBeenCalledWith({
      _id: IDENTIFICATIVO_PRENOTAZIONE
    });
  });

  test('non crea alcuna prenotazione se il ruolo non autorizza la risorsa', async () => {
    servizioRisorse.verificaPrenotabilita.mockImplementation(() => {
      throw new ErroreAutorizzazione('non consentito');
    });

    await expect(
      servizioPrenotazioni.creaPrenotazione(utente, richiestaDiDueOre())
    ).rejects.toThrow(ErroreAutorizzazione);

    expect(Prenotazione.create).not.toHaveBeenCalled();
    expect(Occupazione.insertMany).not.toHaveBeenCalled();
  });

  test('non acquisisce slot se i vincoli temporali non sono rispettati', async () => {
    await expect(
      servizioPrenotazioni.creaPrenotazione(utente, {
        idRisorsa: IDENTIFICATIVO_RISORSA,
        dataOraInizio: domaniAlle(9, 15),
        dataOraFine: domaniAlle(11)
      })
    ).rejects.toThrow(/allineat/);

    expect(Occupazione.insertMany).not.toHaveBeenCalled();
  });
});
