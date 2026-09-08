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
//
// La creazione avviene con un aggiornamento con upsert e non con una lettura seguita da
// una scrittura. Su un database vuoto le prime richieste arrivano contemporaneamente e
// tutte troverebbero la configurazione assente, tentando poi di crearla: l'indice
// univoco sulla chiave del singleton ne farebbe fallire tutte tranne una. È la stessa
// corsa critica che il sistema evita sugli slot delle risorse, e la soluzione è la
// stessa: una sola operazione atomica al posto di due distinte.
async function ottieniConfigurazione() {
  try {
    return await Configurazione.findOneAndUpdate(
      { chiave: 'globale' },
      { $setOnInsert: { chiave: 'globale' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (errore) {
    // Due upsert simultanei possono comunque collidere: se è accaduto, il documento
    // ora esiste perché lo ha inserito l'altra richiesta, e basta rileggerlo.
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
