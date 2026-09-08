const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Utente = require('../../src/modelli/Utente');
const { Aula, Laboratorio } = require('../../src/modelli/RisorsaPrenotabile');
const servizioAutenticazione = require('../../src/servizi/servizioAutenticazione');
const { creaApplicazione } = require('../../server');

// I test di integrazione girano contro una vera istanza di MongoDB avviata in memoria:
// senza di essa non sarebbero verificabili né gli indici né il comportamento del driver,
// che è esattamente ciò che il requisito sulla concorrenza mette alla prova.
let istanzaMongo;

async function avviaAmbiente() {
  istanzaMongo = await MongoMemoryServer.create();
  await mongoose.connect(istanzaMongo.getUri());

  // Gli indici vanno creati esplicitamente prima dei test: l'indice univoco su
  // Occupazione è il vincolo che i test di concorrenza devono poter osservare.
  await Promise.all(
    Object.values(mongoose.models).map((modello) => modello.init())
  );
}

async function chiudiAmbiente() {
  await mongoose.disconnect();
  await istanzaMongo.stop();
}

// Svuota i documenti conservando gli indici: eliminare le collezioni li distruggerebbe
// e il test successivo verrebbe eseguito senza il vincolo di unicità.
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

// Restituisce l'intestazione di autorizzazione pronta per essere passata a Supertest.
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

// Istante di domani a un orario dato: i test non possono usare date fisse, perché una
// prenotazione nel passato viene respinta dalle regole di dominio.
function domaniAlle(ore, minuti = 0) {
  const istante = new Date();
  istante.setDate(istante.getDate() + 1);
  istante.setHours(ore, minuti, 0, 0);
  return istante;
}

// Il giorno di domani nella forma AAAA-MM-GG attesa dai parametri delle rotte.
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
