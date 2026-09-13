// Errori del dominio. I servizi non conoscono HTTP: la traduzione in codici di
// stato avviene nel gestoreErrori, così i servizi restano usabili anche dal seed
// e dai test di unità.

class ErroreDominio extends Error {
  constructor(messaggio) {
    super(messaggio);
    this.name = this.constructor.name;
  }
}

class ErroreValidazione extends ErroreDominio {}

class ErroreAutenticazione extends ErroreDominio {}

class ErroreAutorizzazione extends ErroreDominio {}

class ErroreNonTrovato extends ErroreDominio {}

class ErroreConflitto extends ErroreDominio {}

module.exports = {
  ErroreDominio,
  ErroreValidazione,
  ErroreAutenticazione,
  ErroreAutorizzazione,
  ErroreNonTrovato,
  ErroreConflitto
};
