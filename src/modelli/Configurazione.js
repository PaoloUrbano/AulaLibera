const mongoose = require('mongoose');

// Espressione di un orario nella forma HH:MM su 24 ore.
const FORMATO_ORARIO = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Documento singleton: i parametri globali del sistema sono uno solo e devono restare
// uno solo. Il campo "chiave" con valore fisso e indice univoco impedisce che una
// seconda configurazione venga creata per errore.
const schemaConfigurazione = new mongoose.Schema(
  {
    chiave: {
      type: String,
      default: 'globale',
      enum: ['globale'],
      unique: true
    },

    // Granularità della prenotazione: è anche l'ampiezza degli slot di Occupazione.
    durataSlotMinuti: { type: Number, default: 30, min: 1 },

    anticipoMassimoGiorni: { type: Number, default: 30, min: 1 },
    orarioApertura: { type: String, default: '08:00', match: FORMATO_ORARIO },
    orarioChiusura: { type: String, default: '20:00', match: FORMATO_ORARIO },
    dominioEmailConsentito: { type: String, default: '@poliba.it', trim: true }
  },
  { timestamps: true }
);

schemaConfigurazione.pre('validate', function (successivo) {
  if (this.orarioApertura >= this.orarioChiusura) {
    return successivo(
      new Error("L'orario di apertura deve precedere quello di chiusura")
    );
  }
  successivo();
});

const Configurazione = mongoose.model('Configurazione', schemaConfigurazione);

Configurazione.FORMATO_ORARIO = FORMATO_ORARIO;

module.exports = Configurazione;
