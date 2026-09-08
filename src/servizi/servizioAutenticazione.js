const jwt = require('jsonwebtoken');

const Utente = require('../modelli/Utente');
const servizioConfigurazione = require('./servizioConfigurazione');
const {
  ErroreValidazione,
  ErroreAutenticazione,
  ErroreConflitto,
  ErroreNonTrovato
} = require('./errori');

// Ruoli che un utente può assegnarsi registrandosi: il ruolo di amministratore non è
// autoassegnabile, viene creato dallo script di popolamento del database.
const RUOLI_REGISTRABILI = ['studente', 'docente'];

const LUNGHEZZA_MINIMA_PASSWORD = 8;

// Il segreto è letto a ogni invocazione e non alla prima importazione del modulo:
// così il valore usato è sempre quello dell'ambiente corrente, condizione necessaria
// perché i test possano configurarlo autonomamente.
function segretoJwt() {
  const segreto = process.env.JWT_SEGRETO;
  if (!segreto) {
    throw new Error('Variabile di ambiente JWT_SEGRETO non impostata');
  }
  return segreto;
}

function scadenzaJwt() {
  return process.env.JWT_SCADENZA || '8h';
}

async function registra({ nome, cognome, email, password, ruolo }) {
  if (!nome || !cognome || !email || !password) {
    throw new ErroreValidazione('Nome, cognome, email e password sono obbligatori');
  }

  if (!RUOLI_REGISTRABILI.includes(ruolo)) {
    throw new ErroreValidazione(
      `Il ruolo deve essere uno fra: ${RUOLI_REGISTRABILI.join(', ')}`
    );
  }

  if (password.length < LUNGHEZZA_MINIMA_PASSWORD) {
    throw new ErroreValidazione(
      `La password deve contenere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri`
    );
  }

  const emailNormalizzata = String(email).trim().toLowerCase();

  // Il dominio ammesso è un parametro di configurazione e non una costante del codice,
  // perché l'amministratore deve poterlo cambiare senza rilasciare una nuova versione.
  const configurazione = await servizioConfigurazione.ottieniConfigurazione();
  const dominio = configurazione.dominioEmailConsentito.toLowerCase();
  if (!emailNormalizzata.endsWith(dominio)) {
    throw new ErroreValidazione(
      `Sono ammesse solo email del dominio ${configurazione.dominioEmailConsentito}`
    );
  }

  if (await Utente.exists({ email: emailNormalizzata })) {
    throw new ErroreConflitto('Esiste già un utente registrato con questa email');
  }

  const passwordHash = await Utente.calcolaHashPassword(password);

  return Utente.create({
    nome,
    cognome,
    email: emailNormalizzata,
    passwordHash,
    ruolo
  });
}

async function accedi({ email, password }) {
  if (!email || !password) {
    throw new ErroreValidazione('Email e password sono obbligatorie');
  }

  const utente = await Utente.findOne({
    email: String(email).trim().toLowerCase()
  });

  // Lo stesso messaggio per utente inesistente e password errata: distinguere i due casi
  // rivelerebbe quali email sono registrate nel sistema.
  const messaggioGenerico = 'Credenziali non valide';

  if (!utente) {
    throw new ErroreAutenticazione(messaggioGenerico);
  }

  if (!(await utente.verificaPassword(password))) {
    throw new ErroreAutenticazione(messaggioGenerico);
  }

  return { token: generaToken(utente), utente };
}

// Il token trasporta identificativo e ruolo: sono i due dati che il middleware di
// autorizzazione deve conoscere per ogni richiesta.
function generaToken(utente) {
  return jwt.sign(
    { id: String(utente._id), ruolo: utente.ruolo },
    segretoJwt(),
    { expiresIn: scadenzaJwt() }
  );
}

function verificaToken(token) {
  try {
    return jwt.verify(token, segretoJwt());
  } catch (errore) {
    throw new ErroreAutenticazione('Token assente, scaduto o non valido');
  }
}

// Il middleware ricarica l'utente dal database a ogni richiesta anziché fidarsi del
// contenuto del token: ruolo e abilitazioni possono essere stati modificati
// dall'amministratore dopo l'emissione del token.
async function caricaUtente(idUtente) {
  const utente = await Utente.findById(idUtente);
  if (!utente) {
    throw new ErroreNonTrovato('Utente non trovato');
  }
  return utente;
}

module.exports = {
  RUOLI_REGISTRABILI,
  LUNGHEZZA_MINIMA_PASSWORD,
  registra,
  accedi,
  generaToken,
  verificaToken,
  caricaUtente
};
