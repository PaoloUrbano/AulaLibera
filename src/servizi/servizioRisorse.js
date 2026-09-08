const {
  RisorsaPrenotabile,
  Aula,
  Laboratorio
} = require('../modelli/RisorsaPrenotabile');
const Utente = require('../modelli/Utente');
const Occupazione = require('../modelli/Occupazione');
const servizioConfigurazione = require('./servizioConfigurazione');
const tempo = require('./tempo');
const {
  ErroreValidazione,
  ErroreAutorizzazione,
  ErroreNonTrovato,
  ErroreConflitto
} = require('./errori');

// Campi che l'amministratore può valorizzare: enumerarli evita che una richiesta possa
// scrivere campi interni come tipoRisorsa, che determina la sottoclasse del documento.
const CAMPI_COMUNI = [
  'codice',
  'nome',
  'edificio',
  'piano',
  'capienza',
  'durataMinimaMinuti',
  'durataMassimaMinuti',
  'attiva'
];
const CAMPI_AULA = ['tipoAula', 'haProiettore', 'haLavagnaInterattiva'];
const CAMPI_LABORATORIO = [
  'dipartimento',
  'numeroPostazioni',
  'softwareInstallato',
  'richiedeAbilitazione'
];

// ---------------------------------------------------------------------------
// REGOLE DI PRENOTABILITÀ PER RUOLO
// ---------------------------------------------------------------------------

// Restituisce il motivo per cui l'utente non può prenotare la risorsa, oppure null se
// può. Una sola funzione decide la regola, usata sia per filtrare l'elenco mostrato
// all'utente sia per autorizzare la creazione della prenotazione: l'elenco filtrato è
// comodità d'uso, il controllo in fase di creazione è la vera applicazione della regola.
function motivoNonPrenotabile(utente, risorsa) {
  if (utente.ruolo === 'amministratore') {
    return "L'amministratore gestisce le risorse ma non effettua prenotazioni";
  }

  if (!risorsa.attiva) {
    return 'La risorsa non è attualmente prenotabile';
  }

  if (risorsa.tipoRisorsa === 'Aula') {
    if (utente.ruolo === 'studente' && risorsa.tipoAula !== 'studio') {
      return 'Gli studenti possono prenotare soltanto aule di tipo studio';
    }
    return null;
  }

  if (risorsa.tipoRisorsa === 'Laboratorio') {
    if (
      utente.ruolo === 'studente' &&
      risorsa.richiedeAbilitazione &&
      !utente.eAbilitatoAlLaboratorio(risorsa._id)
    ) {
      return "Non risulti abilitato all'uso di questo laboratorio";
    }
    return null;
  }

  return 'Tipo di risorsa non riconosciuto';
}

function puoPrenotare(utente, risorsa) {
  return motivoNonPrenotabile(utente, risorsa) === null;
}

function verificaPrenotabilita(utente, risorsa) {
  const motivo = motivoNonPrenotabile(utente, risorsa);
  if (motivo) {
    throw new ErroreAutorizzazione(motivo);
  }
}

// ---------------------------------------------------------------------------
// CONSULTAZIONE
// ---------------------------------------------------------------------------

async function ottieniRisorsa(idRisorsa) {
  const risorsa = await RisorsaPrenotabile.findById(idRisorsa);
  if (!risorsa) {
    throw new ErroreNonTrovato('Risorsa non trovata');
  }
  return risorsa;
}

// Elenca le risorse applicando i filtri richiesti e, se è indicato un utente non
// amministratore, nasconde quelle che il suo ruolo non gli consente di prenotare.
async function elencaRisorse(filtri = {}, utente = null) {
  const {
    tipoRisorsa,
    tipoAula,
    dipartimento,
    giorno,
    oraInizio,
    oraFine,
    includiDisattivate = false
  } = filtri;

  const interrogazione = {};

  if (tipoRisorsa) {
    interrogazione.tipoRisorsa = tipoRisorsa;
  }
  if (tipoAula) {
    interrogazione.tipoAula = tipoAula;
  }
  if (dipartimento) {
    interrogazione.dipartimento = dipartimento;
  }

  // Solo l'amministratore vede le risorse disattivate: per gli altri non esistono.
  const eAmministratore = Boolean(utente) && utente.ruolo === 'amministratore';
  if (!includiDisattivate || !eAmministratore) {
    interrogazione.attiva = true;
  }

  let risorse = await RisorsaPrenotabile.find(interrogazione).sort({ codice: 1 });

  if (utente && !eAmministratore) {
    risorse = risorse.filter((risorsa) => puoPrenotare(utente, risorsa));
  }

  // Filtro di disponibilità: se è indicata una fascia oraria, restano solo le risorse
  // che non hanno alcuno slot già occupato in quella fascia.
  if (giorno && oraInizio && oraFine) {
    const occupate = await risorseOccupateNellaFascia(
      risorse.map((risorsa) => risorsa._id),
      giorno,
      oraInizio,
      oraFine
    );
    risorse = risorse.filter((risorsa) => !occupate.has(String(risorsa._id)));
  }

  return risorse;
}

// Restituisce l'insieme degli identificativi delle risorse che risultano occupate anche
// per un solo slot della fascia indicata.
async function risorseOccupateNellaFascia(idRisorse, giorno, oraInizio, oraFine) {
  const configurazione = await servizioConfigurazione.ottieniConfigurazione();
  const inizio = tempo.componiData(giorno, oraInizio);
  const fine = tempo.componiData(giorno, oraFine);

  if (!(fine > inizio)) {
    throw new ErroreValidazione(
      "L'ora di fine della fascia deve seguire l'ora di inizio"
    );
  }

  const slot = tempo.elencaSlot(inizio, fine, configurazione.durataSlotMinuti);

  const occupazioni = await Occupazione.find({
    risorsa: { $in: idRisorse },
    slotInizio: { $in: slot }
  }).select('risorsa');

  return new Set(occupazioni.map((occupazione) => String(occupazione.risorsa)));
}

// Slot già occupati di una risorsa in un giorno: consente al frontend di mostrare la
// disponibilità prima che l'utente invii la richiesta di prenotazione.
async function slotOccupati(idRisorsa, giorno) {
  const configurazione = await servizioConfigurazione.ottieniConfigurazione();
  const inizioGiornata = tempo.componiData(giorno, '00:00');
  const inizioGiornoSuccessivo = new Date(inizioGiornata);
  inizioGiornoSuccessivo.setDate(inizioGiornoSuccessivo.getDate() + 1);

  const occupazioni = await Occupazione.find({
    risorsa: idRisorsa,
    slotInizio: { $gte: inizioGiornata, $lt: inizioGiornoSuccessivo }
  })
    .select('slotInizio')
    .sort({ slotInizio: 1 });

  return {
    durataSlotMinuti: configurazione.durataSlotMinuti,
    slot: occupazioni.map((occupazione) => occupazione.slotInizio)
  };
}

// ---------------------------------------------------------------------------
// GESTIONE (riservata all'amministratore)
// ---------------------------------------------------------------------------

function estraiCampi(origine, campiAmmessi) {
  const risultato = {};
  for (const campo of campiAmmessi) {
    if (origine[campo] !== undefined) {
      risultato[campo] = origine[campo];
    }
  }
  return risultato;
}

async function creaRisorsa(dati) {
  if (dati.tipoRisorsa === 'Aula') {
    return salvaNuova(Aula, dati, CAMPI_AULA);
  }
  if (dati.tipoRisorsa === 'Laboratorio') {
    return salvaNuova(Laboratorio, dati, CAMPI_LABORATORIO);
  }

  throw new ErroreValidazione(
    'Il campo tipoRisorsa deve valere Aula oppure Laboratorio'
  );
}

async function salvaNuova(Modello, dati, campiSpecifici) {
  const documento = {
    ...estraiCampi(dati, CAMPI_COMUNI),
    ...estraiCampi(dati, campiSpecifici)
  };

  try {
    return await Modello.create(documento);
  } catch (errore) {
    throw traduciErroreDiScrittura(errore);
  }
}

async function aggiornaRisorsa(idRisorsa, modifiche) {
  const risorsa = await ottieniRisorsa(idRisorsa);

  const campiSpecifici =
    risorsa.tipoRisorsa === 'Aula' ? CAMPI_AULA : CAMPI_LABORATORIO;

  Object.assign(risorsa, {
    ...estraiCampi(modifiche, CAMPI_COMUNI),
    ...estraiCampi(modifiche, campiSpecifici)
  });

  try {
    return await risorsa.save();
  } catch (errore) {
    throw traduciErroreDiScrittura(errore);
  }
}

// La disattivazione è distinta dall'eliminazione: rende la risorsa non prenotabile
// lasciando integro lo storico delle prenotazioni che la riferiscono.
async function impostaAttivazione(idRisorsa, attiva) {
  const risorsa = await ottieniRisorsa(idRisorsa);
  risorsa.attiva = attiva;
  return risorsa.save();
}

// L'eliminazione è consentita solo in assenza di occupazioni: cancellare una risorsa
// prenotata lascerebbe prenotazioni che puntano a un documento inesistente.
async function eliminaRisorsa(idRisorsa) {
  const risorsa = await ottieniRisorsa(idRisorsa);

  if (await Occupazione.exists({ risorsa: risorsa._id })) {
    throw new ErroreConflitto(
      'La risorsa ha prenotazioni attive: disattivarla anziché eliminarla'
    );
  }

  await risorsa.deleteOne();
  return risorsa;
}

// ---------------------------------------------------------------------------
// ABILITAZIONI AI LABORATORI
// ---------------------------------------------------------------------------

// L'abilitazione lega uno studente a un laboratorio: gestisce l'associazione modellata
// in Utente.abilitazioniLaboratori ed è collocata fra le operazioni sulle risorse
// perché è il laboratorio, con richiedeAbilitazione, a renderla necessaria.
async function impostaAbilitazione(idStudente, idLaboratorio, abilitato) {
  const studente = await Utente.findById(idStudente);
  if (!studente) {
    throw new ErroreNonTrovato('Utente non trovato');
  }
  if (studente.ruolo !== 'studente') {
    throw new ErroreValidazione(
      "L'abilitazione ai laboratori riguarda soltanto gli studenti"
    );
  }

  const laboratorio = await ottieniRisorsa(idLaboratorio);
  if (laboratorio.tipoRisorsa !== 'Laboratorio') {
    throw new ErroreValidazione('La risorsa indicata non è un laboratorio');
  }

  const giaAbilitato = studente.eAbilitatoAlLaboratorio(laboratorio._id);

  if (abilitato && !giaAbilitato) {
    studente.abilitazioniLaboratori.push(laboratorio._id);
  }
  if (!abilitato && giaAbilitato) {
    studente.abilitazioniLaboratori = studente.abilitazioniLaboratori.filter(
      (identificativo) => String(identificativo) !== String(laboratorio._id)
    );
  }

  return studente.save();
}

async function elencaStudenti() {
  return Utente.find({ ruolo: 'studente' })
    .sort({ cognome: 1, nome: 1 })
    .populate('abilitazioniLaboratori', 'codice nome dipartimento');
}

// Traduce gli errori del driver e della validazione di Mongoose in errori di dominio:
// i livelli superiori non devono conoscere i codici di errore di MongoDB.
function traduciErroreDiScrittura(errore) {
  if (errore.code === 11000) {
    return new ErroreConflitto('Esiste già una risorsa con questo codice');
  }
  return new ErroreValidazione(errore.message);
}

module.exports = {
  CAMPI_COMUNI,
  CAMPI_AULA,
  CAMPI_LABORATORIO,
  motivoNonPrenotabile,
  puoPrenotare,
  verificaPrenotabilita,
  ottieniRisorsa,
  elencaRisorse,
  slotOccupati,
  creaRisorsa,
  aggiornaRisorsa,
  impostaAttivazione,
  eliminaRisorsa,
  impostaAbilitazione,
  elencaStudenti
};
