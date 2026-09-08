// Il livello di logica di business segnala i propri fallimenti con errori che descrivono
// la natura del problema nel linguaggio del dominio, non con codici HTTP: la traduzione
// in risposta HTTP avviene nel gestoreErrori, che appartiene al livello di interfaccia.
// È questa separazione che consente di riusare i servizi al di fuori di Express — per
// esempio negli script di seed e nei test di unità.

class ErroreDominio extends Error {
  constructor(messaggio) {
    super(messaggio);
    this.name = this.constructor.name;
  }
}

// Dati non validi o violazione di una regola di dominio sui valori.
class ErroreValidazione extends ErroreDominio {}

// Credenziali assenti o non valide.
class ErroreAutenticazione extends ErroreDominio {}

// Utente riconosciuto ma privo dei permessi necessari per l'operazione.
class ErroreAutorizzazione extends ErroreDominio {}

// Entità inesistente.
class ErroreNonTrovato extends ErroreDominio {}

// Conflitto con lo stato corrente del sistema: risorsa già occupata, email già registrata.
class ErroreConflitto extends ErroreDominio {}

module.exports = {
  ErroreDominio,
  ErroreValidazione,
  ErroreAutenticazione,
  ErroreAutorizzazione,
  ErroreNonTrovato,
  ErroreConflitto
};
