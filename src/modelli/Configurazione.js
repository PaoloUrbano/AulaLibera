const mongoose = require('mongoose');

const FORMATO_ORARIO = /^([01]\d|2[0-3]):([0-5]\d)$/;

// singleton: la chiave fissa con indice univoco impedisce un secondo documento
const schemaConfigurazione = new mongoose.Schema(
  {
    chiave: {
      type: String,
      default: 'globale',
      enum: ['globale'],
      unique: true
    },
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
