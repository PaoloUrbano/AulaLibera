const mongoose = require('mongoose');

const DIPARTIMENTI = ['DMMM', 'DEI', 'DICATECh', 'ArCoD'];
const TIPI_AULA = ['didattica', 'studio'];

// RisorsaPrenotabile è la classe base astratta del modello di dominio: non viene mai
// istanziata direttamente, esistono solo le sue due specializzazioni.
const schemaRisorsaPrenotabile = new mongoose.Schema(
  {
    codice: { type: String, required: true, unique: true, trim: true, uppercase: true },
    nome: { type: String, required: true, trim: true },
    edificio: { type: String, required: true, trim: true },
    piano: { type: Number, required: true },
    capienza: { type: Number, required: true, min: 1 },

    // Durate ammesse per una singola prenotazione di questa risorsa. Sono attributi della
    // risorsa e non della configurazione globale perché un laboratorio e un'aula studio
    // hanno vincoli d'uso diversi; l'amministratore le imposta risorsa per risorsa.
    durataMinimaMinuti: { type: Number, default: 60, min: 1 },
    durataMassimaMinuti: { type: Number, default: 240, min: 1 },

    // Disattivare una risorsa la rende non prenotabile conservandone lo storico:
    // le prenotazioni passate restano riferite a un documento esistente.
    attiva: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    // La generalizzazione UML è tradotta con il discriminator di Mongoose: le tre classi
    // condividono una sola collezione e il campo tipoRisorsa indica la sottoclasse
    // concreta. È l'equivalente documentale della strategia "single table inheritance".
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

    // Elenco denormalizzato: i nomi dei software non hanno identità propria nel dominio
    // e non sono referenziati da altre entità, quindi un array di stringhe è la
    // modellazione idiomatica in MongoDB.
    softwareInstallato: { type: [String], default: [] },

    // Se vero, lo studente può prenotare solo se l'amministratore lo ha abilitato.
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
