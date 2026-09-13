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

// codice restituito da MongoDB per violazione di indice univoco
const ERRORE_CHIAVE_DUPLICATA = 11000;

// transizioni del diagramma di stato; annullata e conclusa sono terminali
const TRANSIZIONI_AMMESSE = {
  richiesta: ['confermata', 'annullata', 'conclusa'],
  confermata: ['conclusa', 'annullata'],
  annullata: [],
  conclusa: []
};

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

// Mutua esclusione sugli slot.
//
// Un find delle sovrapposizioni seguito da un insert non basta: fra la lettura e la
// scrittura un'altra richiesta può leggere a sua volta e trovare la risorsa ancora
// libera, e a quel punto entrambe le insert riescono. MongoDB non ha un vincolo di
// esclusione su intervalli (Postgres ce l'ha, EXCLUDE USING gist), quindi l'intervallo
// viene spezzato in slot e ogni slot diventa un documento Occupazione. L'indice univoco
// su (risorsa, slotInizio) fa il controllo al momento della scrittura: di due insert
// concorrenti sullo stesso slot ne passa una sola, l'altra riceve il codice 11000.
// La garanzia sta nell'indice, non nel codice, e vale anche con più istanze del server.
async function creaPrenotazione(utente, dati) {
  const { idRisorsa, dataOraInizio, dataOraFine, motivazione } = dati;

  const risorsa = await servizioRisorse.ottieniRisorsa(idRisorsa);

  servizioRisorse.verificaPrenotabilita(utente, risorsa);

  const configurazione = await servizioConfigurazione.ottieniConfigurazione();

  const inizio = new Date(dataOraInizio);
  const fine = new Date(dataOraFine);

  verificaVincoliTemporali(inizio, fine, risorsa, configurazione);

  const slot = tempo.elencaSlot(inizio, fine, configurazione.durataSlotMinuti);

  // la prenotazione va creata prima perché le occupazioni la riferiscono;
  // se l'acquisizione degli slot fallisce viene rimossa
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
    // ordered: true si ferma al primo slot già preso; quelli inseriti prima
    // del conflitto vengono tolti dalla compensazione qui sotto
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

// niente transazioni su un'istanza singola di MongoDB: la compensazione è esplicita
async function annullaAcquisizioneSlot(idPrenotazione) {
  await Occupazione.deleteMany({ prenotazione: idPrenotazione });
  await Prenotazione.deleteOne({ _id: idPrenotazione });
}

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

async function elencaTuttePrenotazioni(filtri = {}) {
  return Prenotazione.find(costruisciFiltro(filtri))
    .sort({ dataOraInizio: -1 })
    .populate('risorsa', 'codice nome edificio piano tipoRisorsa tipoAula dipartimento')
    .populate('utente', 'nome cognome email ruolo');
}

// unico punto in cui cambia lo stato di una prenotazione
async function cambiaStato(idPrenotazione, nuovoStato, utenteRichiedente) {
  const prenotazione = await ottieniPrenotazione(idPrenotazione);

  const eAmministratore = utenteRichiedente.ruolo === 'amministratore';
  const eProprietario =
    String(prenotazione.utente) === String(utenteRichiedente._id);

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

  // solo l'annullamento libera gli slot
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
