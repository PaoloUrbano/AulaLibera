const mongoose = require('mongoose');

// Entità tecnica: uno slot occupato = un documento. Serve solo a far applicare la
// mutua esclusione dal database anziché dal codice.
const schemaOccupazione = new mongoose.Schema(
  {
    risorsa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RisorsaPrenotabile',
      required: true
    },
    slotInizio: { type: Date, required: true },
    prenotazione: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prenotazione',
      required: true
    }
  },
  { timestamps: true }
);

// È questo indice a garantire il requisito di concorrenza: due insert sulla stessa
// coppia (risorsa, slotInizio) non possono riuscire entrambe, in nessun ordine.
schemaOccupazione.index({ risorsa: 1, slotInizio: 1 }, { unique: true });

schemaOccupazione.index({ prenotazione: 1 });

module.exports = mongoose.model('Occupazione', schemaOccupazione);
