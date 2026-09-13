const {
  ErroreDominio,
  ErroreValidazione,
  ErroreAutenticazione,
  ErroreAutorizzazione,
  ErroreNonTrovato,
  ErroreConflitto
} = require('../servizi/errori');

// unico punto in cui gli errori di dominio diventano codici HTTP
const CODICI = [
  [ErroreValidazione, 400],
  [ErroreAutenticazione, 401],
  [ErroreAutorizzazione, 403],
  [ErroreNonTrovato, 404],
  [ErroreConflitto, 409]
];

function codiceHttpPer(errore) {
  const corrispondenza = CODICI.find(([Tipo]) => errore instanceof Tipo);
  return corrispondenza ? corrispondenza[1] : 500;
}

// Express 4 non inoltra le promesse rifiutate al gestore degli errori
function catturaErrori(gestore) {
  return (richiesta, risposta, successivo) => {
    Promise.resolve(gestore(richiesta, risposta, successivo)).catch(successivo);
  };
}

function rottaNonTrovata(richiesta, risposta) {
  risposta.status(404).json({ errore: 'Endpoint non trovato' });
}

function gestoreErrori(errore, richiesta, risposta, successivo) {
  const codice = codiceHttpPer(errore);

  // gli errori non previsti sono difetti: log completo, messaggio generico al client
  if (codice === 500) {
    console.error('Errore non gestito:', errore);
    return risposta.status(500).json({ errore: 'Errore interno del server' });
  }

  return risposta.status(codice).json({ errore: errore.message });
}

module.exports = {
  ErroreDominio,
  codiceHttpPer,
  catturaErrori,
  rottaNonTrovata,
  gestoreErrori
};
