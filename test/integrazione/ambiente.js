const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Utente = require('../../src/modelli/Utente');
const { Aula, Laboratorio } = require('../../src/modelli/RisorsaPrenotabile');
const servizioAutenticazione = require('../../src/servizi/servizioAutenticazione');
const { creaApplicazione } = require('../../server');

let istanzaMongo;

async function avviaAmbiente() {
  istanzaMongo = await MongoMemoryServer.create();
  await mongoose.connect(istanzaMongo.getUri());

  await Promise.all(
    Object.values(mongoose.models).map((modello) => modello.init())
  );
}

async function chiudiAmbiente() {
  await mongoose.disconnect();
  await istanzaMongo.stop();
}

// deleteMany e non drop: il drop toglierebbe anche l'indice univoco
async function svuotaDatabase() {
  const collezioni = Object.values(mongoose.connection.collections);
  await Promise.all(collezioni.map((collezione) => collezione.deleteMany({})));
}

async function creaUtente({ ruolo, email, password = 'password-di-prova' }) {
  return Utente.create({
    nome: 'Nome',
    cognome: ruolo,
    email,
    passwordHash: await Utente.calcolaHashPassword(password),
    ruolo
  });
}

function autorizzazione(utente) {
  return `Bearer ${servizioAutenticazione.generaToken(utente)}`;
}

function creaAula(modifiche = {}) {
  return Aula.create({
    codice: 'A01',
    nome: 'Aula studio di prova',
    edificio: 'Q',
    piano: 0,
    capienza: 40,
    tipoAula: 'studio',
    ...modifiche
  });
}

function creaLaboratorio(modifiche = {}) {
  return Laboratorio.create({
    codice: 'L01',
    nome: 'Laboratorio di prova',
    edificio: 'Q',
    piano: 1,
    capienza: 20,
    dipartimento: 'DEI',
    numeroPostazioni: 20,
    ...modifiche
  });
}

// niente date fisse: una prenotazione nel passato viene rifiutata
function domaniAlle(ore, minuti = 0) {
  const istante = new Date();
  istante.setDate(istante.getDate() + 1);
  istante.setHours(ore, minuti, 0, 0);
  return istante;
}

function giornoDomani() {
  const istante = domaniAlle(0);
  const mese = String(istante.getMonth() + 1).padStart(2, '0');
  const giorno = String(istante.getDate()).padStart(2, '0');
  return `${istante.getFullYear()}-${mese}-${giorno}`;
}

module.exports = {
  avviaAmbiente,
  chiudiAmbiente,
  svuotaDatabase,
  creaUtente,
  autorizzazione,
  creaAula,
  creaLaboratorio,
  domaniAlle,
  giornoDomani,
  creaApplicazione
};
