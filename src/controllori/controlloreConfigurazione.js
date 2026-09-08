const servizioConfigurazione = require('../servizi/servizioConfigurazione');

// La configurazione è leggibile da qualunque utente autenticato perché il client deve
// conoscere granularità degli slot e orari per proporre fasce orarie valide; la
// modifica è invece riservata all'amministratore dal middleware sulla rotta.
async function ottieni(richiesta, risposta) {
  const configurazione = await servizioConfigurazione.ottieniConfigurazione();
  risposta.json({ configurazione });
}

async function aggiorna(richiesta, risposta) {
  const configurazione = await servizioConfigurazione.aggiornaConfigurazione(
    richiesta.body
  );
  risposta.json({ configurazione });
}

module.exports = { ottieni, aggiorna };
