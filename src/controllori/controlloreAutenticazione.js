const servizioAutenticazione = require('../servizi/servizioAutenticazione');

// I controllori appartengono al livello di interfaccia: traducono la richiesta HTTP in
// una chiamata al servizio e il risultato in una risposta. Non contengono regole di
// dominio e non accedono mai direttamente ai modelli.

async function registra(richiesta, risposta) {
  const utente = await servizioAutenticazione.registra(richiesta.body);
  risposta.status(201).json({ utente: utente.versionePubblica() });
}

async function accedi(richiesta, risposta) {
  const { token, utente } = await servizioAutenticazione.accedi(richiesta.body);
  risposta.json({ token, utente: utente.versionePubblica() });
}

// Con l'autenticazione a token il server non conserva sessioni: la disconnessione
// consiste nello scartare il token sul client. L'endpoint esiste perché il caso d'uso
// esiste e perché il client abbia un punto unico da invocare.
async function esci(richiesta, risposta) {
  risposta.status(204).end();
}

// Consente al client di ricostruire lo stato di autenticazione da un token conservato,
// senza chiedere di nuovo le credenziali.
async function profilo(richiesta, risposta) {
  risposta.json({ utente: richiesta.utente.versionePubblica() });
}

module.exports = { registra, accedi, esci, profilo };
