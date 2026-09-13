const Configurazione = require('../modelli/Configurazione');
const { ErroreValidazione } = require('./errori');

// la chiave del singleton non deve essere modificabile da una richiesta
const CAMPI_MODIFICABILI = [
  'durataSlotMinuti',
  'anticipoMassimoGiorni',
  'orarioApertura',
  'orarioChiusura',
  'dominioEmailConsentito'
];

// Upsert e non find + create: su un database vuoto le prime richieste arrivano
// insieme, troverebbero tutte la configurazione assente e proverebbero tutte a
// crearla. Stessa corsa critica degli slot, stessa soluzione: un'operazione sola.
async function ottieniConfigurazione() {
  try {
    return await Configurazione.findOneAndUpdate(
      { chiave: 'globale' },
      { $setOnInsert: { chiave: 'globale' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (errore) {
    // due upsert simultanei possono comunque collidere: a quel punto il documento
    // esiste, basta rileggerlo
    if (errore.code === 11000) {
      return Configurazione.findOne({ chiave: 'globale' });
    }
    throw errore;
  }
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
