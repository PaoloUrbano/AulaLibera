const Configurazione = require('../modelli/Configurazione');
const { ErroreValidazione } = require('./errori');

// Campi che l'amministratore può modificare. L'elenco è esplicito per impedire che una
// richiesta HTTP possa scrivere campi non previsti (per esempio la chiave del singleton).
const CAMPI_MODIFICABILI = [
  'durataSlotMinuti',
  'anticipoMassimoGiorni',
  'orarioApertura',
  'orarioChiusura',
  'dominioEmailConsentito'
];

// Restituisce il documento di configurazione, creandolo con i valori predefiniti alla
// prima invocazione: il sistema deve poter partire su un database vuoto.
async function ottieniConfigurazione() {
  const esistente = await Configurazione.findOne({ chiave: 'globale' });
  if (esistente) {
    return esistente;
  }
  return Configurazione.create({ chiave: 'globale' });
}

async function aggiornaConfigurazione(modifiche) {
  const configurazione = await ottieniConfigurazione();

  for (const campo of CAMPI_MODIFICABILI) {
    if (modifiche[campo] !== undefined) {
      configurazione[campo] = modifiche[campo];
    }
  }

  if (!configurazione.dominioEmailConsentito.startsWith('@')) {
    throw new ErroreValidazione(
      'Il dominio email consentito deve iniziare con il carattere @'
    );
  }

  try {
    return await configurazione.save();
  } catch (errore) {
    throw new ErroreValidazione(errore.message);
  }
}

module.exports = {
  CAMPI_MODIFICABILI,
  ottieniConfigurazione,
  aggiornaConfigurazione
};
