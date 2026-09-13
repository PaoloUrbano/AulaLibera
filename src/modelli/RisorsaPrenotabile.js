const mongoose = require('mongoose');

const DIPARTIMENTI = ['DMMM', 'DEI', 'DICATECh', 'ArCoD'];
const TIPI_AULA = ['didattica', 'studio'];

// Classe base astratta: non viene istanziata direttamente, esistono solo Aula
// e Laboratorio. La generalizzazione UML è resa con il discriminator: una sola
// collezione, il campo tipoRisorsa indica la sottoclasse.
const schemaRisorsaPrenotabile = new mongoose.Schema(
  {
    codice: { type: String, required: true, unique: true, trim: true, uppercase: true },
    nome: { type: String, required: true, trim: true },
    edificio: { type: String, required: true, trim: true },
    piano: { type: Number, required: true },
    capienza: { type: Number, required: true, min: 1 },

    // durate della singola risorsa, non del sistema: un laboratorio e una sala
    // studio hanno vincoli d'uso diversi
    durataMinimaMinuti: { type: Number, default: 60, min: 1 },
    durataMassimaMinuti: { type: Number, default: 240, min: 1 },

    attiva: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    discriminatorKey: 'tipoRisorsa'
  }
);

schemaRisorsaPrenotabile.pre('validate', function (successivo) {
  if (this.durataMinimaMinuti > this.durataMassimaMinuti) {
    return successivo(
      new Error('La durata minima non può superare la durata massima')
    );
  }
  successivo();
});

const RisorsaPrenotabile = mongoose.model(
  'RisorsaPrenotabile',
  schemaRisorsaPrenotabile
);

const Aula = RisorsaPrenotabile.discriminator(
  'Aula',
  new mongoose.Schema({
    tipoAula: { type: String, enum: TIPI_AULA, required: true },
    haProiettore: { type: Boolean, default: false },
    haLavagnaInterattiva: { type: Boolean, default: false }
  })
);

const Laboratorio = RisorsaPrenotabile.discriminator(
  'Laboratorio',
  new mongoose.Schema({
    dipartimento: { type: String, enum: DIPARTIMENTI, required: true },
    numeroPostazioni: { type: Number, required: true, min: 1 },
    // array di stringhe, non una collezione: i software non sono referenziati altrove
    softwareInstallato: { type: [String], default: [] },
    richiedeAbilitazione: { type: Boolean, default: false }
  })
);

module.exports = {
  RisorsaPrenotabile,
  Aula,
  Laboratorio,
  DIPARTIMENTI,
  TIPI_AULA
};
