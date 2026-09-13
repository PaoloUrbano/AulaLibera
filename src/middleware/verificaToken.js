const servizioAutenticazione = require('../servizi/servizioAutenticazione');
const { ErroreAutenticazione } = require('../servizi/errori');
const { catturaErrori } = require('./gestoreErrori');

function estraiToken(richiesta) {
  const intestazione = richiesta.headers.authorization;
  if (!intestazione || !intestazione.startsWith('Bearer ')) {
    return null;
  }
  return intestazione.slice('Bearer '.length).trim();
}

// L'utente viene riletto dal database a ogni richiesta invece di fidarsi del
// token: ruolo e abilitazioni possono essere cambiati dopo l'emissione.
const verificaToken = catturaErrori(async (richiesta, risposta, successivo) => {
  const token = estraiToken(richiesta);

  if (!token) {
    throw new ErroreAutenticazione('Autenticazione richiesta');
  }

  const contenuto = servizioAutenticazione.verificaToken(token);
  richiesta.utente = await servizioAutenticazione.caricaUtente(contenuto.id);

  successivo();
});

module.exports = verificaToken;
