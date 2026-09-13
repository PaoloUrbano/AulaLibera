const mongoose = require('mongoose');

// quattro valori fissi: un enum, non una collezione a parte
const STATI = ['richiesta', 'confermata', 'annullata', 'conclusa'];

const schemaPrenotazione = new mongoose.Schema(
  {
    risorsa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RisorsaPrenotabile',
      required: true
    },
    utente: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Utente',
      required: true
    },
    dataOraInizio: { type: Date, required: true },
    dataOraFine: { type: Date, required: true },
    motivazione: { type: String, trim: true, maxlength: 500 },
    stato: { type: String, enum: STATI, default: 'richiesta' }
  },
  { timestamps: true }
);

schemaPrenotazione.index({ utente: 1, dataOraInizio: -1 });
schemaPrenotazione.index({ risorsa: 1, dataOraInizio: 1 });

// tutto tranne "annullata" tiene occupata la risorsa
schemaPrenotazione.statics.STATI_ATTIVI = ['richiesta', 'confermata', 'conclusa'];

schemaPrenotazione.methods.eAttiva = function () {
  return this.stato !== 'annullata';
};

const Prenotazione = mongoose.model('Prenotazione', schemaPrenotazione);

Prenotazione.STATI = STATI;

module.exports = Prenotazione;
