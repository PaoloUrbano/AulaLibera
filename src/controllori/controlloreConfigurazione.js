const servizioConfigurazione = require('../servizi/servizioConfigurazione');

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
