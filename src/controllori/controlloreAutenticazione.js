const servizioAutenticazione = require('../servizi/servizioAutenticazione');

async function registra(richiesta, risposta) {
  const utente = await servizioAutenticazione.registra(richiesta.body);
  risposta.status(201).json({ utente: utente.versionePubblica() });
}

async function accedi(richiesta, risposta) {
  const { token, utente } = await servizioAutenticazione.accedi(richiesta.body);
  risposta.json({ token, utente: utente.versionePubblica() });
}

// con i JWT non c'è sessione lato server: il logout consiste nello scartare il token
async function esci(richiesta, risposta) {
  risposta.status(204).end();
}

async function profilo(richiesta, risposta) {
  risposta.json({ utente: richiesta.utente.versionePubblica() });
}

module.exports = { registra, accedi, esci, profilo };
