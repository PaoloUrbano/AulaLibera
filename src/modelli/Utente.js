const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const RUOLI = ['studente', 'docente', 'amministratore'];

const schemaUtente = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    cognome: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: { type: String, required: true },
    ruolo: { type: String, enum: RUOLI, required: true },

    // Elenco dei laboratori il cui uso è stato abilitato all'utente dall'amministratore.
    // È un array di riferimenti e non una collezione di associazioni: in un database
    // documentale l'associazione molti-a-molti si modella così quando un lato è piccolo.
    abilitazioniLaboratori: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'RisorsaPrenotabile' }
    ]
  },
  { timestamps: true }
);

// La password in chiaro non viene mai memorizzata né trasmessa: entra nel modello solo
// come argomento di questi due metodi, che incapsulano l'algoritmo di hashing.
schemaUtente.statics.calcolaHashPassword = function (passwordInChiaro) {
  return bcrypt.hash(passwordInChiaro, 10);
};

schemaUtente.methods.verificaPassword = function (passwordInChiaro) {
  return bcrypt.compare(passwordInChiaro, this.passwordHash);
};

// Rappresentazione destinata al client: esclude l'hash della password.
schemaUtente.methods.versionePubblica = function () {
  return {
    id: this._id,
    nome: this.nome,
    cognome: this.cognome,
    email: this.email,
    ruolo: this.ruolo,
    abilitazioniLaboratori: this.abilitazioniLaboratori
  };
};

schemaUtente.methods.eAbilitatoAlLaboratorio = function (idLaboratorio) {
  return this.abilitazioniLaboratori.some(
    (idAbilitato) => String(idAbilitato) === String(idLaboratorio)
  );
};

const Utente = mongoose.model('Utente', schemaUtente);

Utente.RUOLI = RUOLI;

module.exports = Utente;
