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

// campi scrivibili dall'amministratore; tipoRisorsa resta fuori perché
// determina la sottoclasse del documento
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

// Regola sui ruoli. È usata sia per filtrare l'elenco mostrato all'utente sia per
// autorizzare la creazione: il filtro è comodità, il controllo in creazione è il vincolo.
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

async function ottieniRisorsa(idRisorsa) {
  const risorsa = await RisorsaPrenotabile.findById(idRisorsa);
  if (!risorsa) {
    throw new ErroreNonTrovato('Risorsa non trovata');
  }
  return risorsa;
}

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

  // le disattivate le vede solo l'amministratore
  const eAmministratore = Boolean(utente) && utente.ruolo === 'amministratore';
  if (!includiDisattivate || !eAmministratore) {
    interrogazione.attiva = true;
  }

  let risorse = await RisorsaPrenotabile.find(interrogazione).sort({ codice: 1 });

  if (utente && !eAmministratore) {
    risorse = risorse.filter((risorsa) => puoPrenotare(utente, risorsa));
  }

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

// disattivare conserva lo storico, eliminare no
async function impostaAttivazione(idRisorsa, attiva) {
  const risorsa = await ottieniRisorsa(idRisorsa);
  risorsa.attiva = attiva;
  return risorsa.save();
}

async function eliminaRisorsa(idRisorsa) {
  const risorsa = await ottieniRisorsa(idRisorsa);

  // con occupazioni in giro resterebbero prenotazioni che puntano nel vuoto
  if (await Occupazione.exists({ risorsa: risorsa._id })) {
    throw new ErroreConflitto(
      'La risorsa ha prenotazioni attive: disattivarla anziché eliminarla'
    );
  }

  await risorsa.deleteOne();
  return risorsa;
}

// L'abilitazione sta qui e non nel servizio di autenticazione perché è il
// laboratorio, con richiedeAbilitazione, a renderla necessaria.
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

// i codici di errore di MongoDB non devono uscire dal livello dei servizi
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
