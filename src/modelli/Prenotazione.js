const mongoose = require('mongoose');

const STATI = ['richiesta', 'confermata', 'annullata', 'conclusa'];

// Gli stati sono quattro valori fissi del dominio, non entità con vita propria:
// una collezione dedicata introdurrebbe una join senza aggiungere informazione.
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

// Le due interrogazioni più frequenti sono "le prenotazioni di un utente" e
// "le prenotazioni di una risorsa in un intervallo": entrambe sono servite da un indice.
schemaPrenotazione.index({ utente: 1, dataOraInizio: -1 });
schemaPrenotazione.index({ risorsa: 1, dataOraInizio: 1 });

// Una prenotazione occupa la risorsa finché non viene annullata: gli stati "richiesta",
// "confermata" e "conclusa" sono tutti vincolanti ai fini della mutua esclusione.
schemaPrenotazione.statics.STATI_ATTIVI = ['richiesta', 'confermata', 'conclusa'];

schemaPrenotazione.methods.eAttiva = function () {
  return this.stato !== 'annullata';
};

const Prenotazione = mongoose.model('Prenotazione', schemaPrenotazione);

Prenotazione.STATI = STATI;

module.exports = Prenotazione;
