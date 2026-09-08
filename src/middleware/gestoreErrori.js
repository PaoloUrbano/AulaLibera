const {
  ErroreDominio,
  ErroreValidazione,
  ErroreAutenticazione,
  ErroreAutorizzazione,
  ErroreNonTrovato,
  ErroreConflitto
} = require('../servizi/errori');

// Corrispondenza fra gli errori del dominio e i codici di stato HTTP. La traduzione
// avviene qui e solo qui: il livello di logica di business ignora l'esistenza di HTTP.
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

// Racchiude un gestore asincrono inoltrando a Express le eccezioni che solleva:
// senza questo adattatore una promessa rifiutata in un controllore non raggiungerebbe
// il gestore degli errori e la richiesta resterebbe appesa.
function catturaErrori(gestore) {
  return (richiesta, risposta, successivo) => {
    Promise.resolve(gestore(richiesta, risposta, successivo)).catch(successivo);
  };
}

function rottaNonTrovata(richiesta, risposta) {
  risposta.status(404).json({ errore: 'Endpoint non trovato' });
}

// Middleware finale della catena: Express lo riconosce come gestore degli errori
// dalla presenza di quattro parametri.
function gestoreErrori(errore, richiesta, risposta, successivo) {
  const codice = codiceHttpPer(errore);

  // Gli errori non previsti vengono registrati per intero: sono difetti da correggere,
  // non condizioni del dominio. Al client si restituisce un messaggio generico per non
  // esporre dettagli sull'implementazione.
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
