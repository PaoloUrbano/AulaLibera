const mongoose = require('mongoose');

// Occupazione è un'entità tecnica, non di dominio: materializza in documenti distinti
// gli slot temporali che una prenotazione consuma. Esiste solo per rendere la mutua
// esclusione un vincolo del database anziché un controllo applicativo.
const schemaOccupazione = new mongoose.Schema(
  {
    risorsa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RisorsaPrenotabile',
      required: true
    },

    // Istante di inizio dello slot, sempre allineato a un confine di slot.
    slotInizio: { type: Date, required: true },

    prenotazione: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prenotazione',
      required: true
    }
  },
  { timestamps: true }
);

// VINCOLO CENTRALE DEL SISTEMA.
// L'indice univoco composto è ciò che garantisce che una risorsa non possa risultare
// occupata due volte nello stesso slot. Il controllo è demandato al motore del database
// e non al codice applicativo: due inserimenti concorrenti sulla stessa coppia
// (risorsa, slotInizio) non possono riuscire entrambi, qualunque sia il loro ordine.
schemaOccupazione.index({ risorsa: 1, slotInizio: 1 }, { unique: true });

// Serve a rimuovere in un'unica operazione tutti gli slot di una prenotazione annullata.
schemaOccupazione.index({ prenotazione: 1 });

module.exports = mongoose.model('Occupazione', schemaOccupazione);
