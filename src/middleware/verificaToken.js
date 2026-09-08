const servizioAutenticazione = require('../servizi/servizioAutenticazione');
const { ErroreAutenticazione } = require('../servizi/errori');
const { catturaErrori } = require('./gestoreErrori');

// Estrae il token dall'intestazione Authorization nella forma "Bearer <token>".
function estraiToken(richiesta) {
  const intestazione = richiesta.headers.authorization;
  if (!intestazione || !intestazione.startsWith('Bearer ')) {
    return null;
  }
  return intestazione.slice('Bearer '.length).trim();
}

// Autentica la richiesta e rende disponibile l'utente ai controllori come req.utente.
// L'utente viene ricaricato dal database a ogni richiesta e non ricostruito dal token:
// ruolo e abilitazioni possono essere cambiati dopo l'emissione del token, e continuare
// a fidarsi del suo contenuto significherebbe applicare permessi obsoleti.
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
