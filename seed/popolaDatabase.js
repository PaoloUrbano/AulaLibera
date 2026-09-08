require('dotenv').config();

const mongoose = require('mongoose');

const Utente = require('../src/modelli/Utente');
const {
  RisorsaPrenotabile,
  Aula,
  Laboratorio
} = require('../src/modelli/RisorsaPrenotabile');
const Prenotazione = require('../src/modelli/Prenotazione');
const Occupazione = require('../src/modelli/Occupazione');
const Configurazione = require('../src/modelli/Configurazione');

// Password comune a tutti gli utenti di esempio: è un ambiente di dimostrazione, e
// averla unica rende la prova del sistema immediata. In esercizio non esisterebbe.
const PASSWORD_DI_ESEMPIO = 'password-di-prova';

// I nomi che seguono sono dati, non modello: descrivono il patrimonio del Politecnico
// di Bari perché la dimostrazione sia credibile, e non influenzano gli schemi.
const LABORATORI = [
  {
    codice: 'DMMM-PRRE',
    nome: 'Laboratorio di Prototipazione Rapida e Reverse Engineering',
    edificio: 'DMMM',
    piano: 0,
    capienza: 20,
    dipartimento: 'DMMM',
    numeroPostazioni: 12,
    softwareInstallato: ['SolidWorks', 'Geomagic Design X', 'Cura'],
    richiedeAbilitazione: true,
    durataMinimaMinuti: 60,
    durataMassimaMinuti: 180
  },
  {
    codice: 'DMMM-MACI',
    nome: 'Laboratorio di Macchine Idrauliche',
    edificio: 'DMMM',
    piano: 0,
    capienza: 15,
    dipartimento: 'DMMM',
    numeroPostazioni: 8,
    softwareInstallato: ['LabVIEW', 'Ansys Fluent'],
    richiedeAbilitazione: true,
    durataMinimaMinuti: 120,
    durataMassimaMinuti: 240
  },
  {
    codice: 'DMMM-LACO',
    nome: 'Laboratorio di Combustione (LACO)',
    edificio: 'DMMM',
    piano: -1,
    capienza: 12,
    dipartimento: 'DMMM',
    numeroPostazioni: 6,
    softwareInstallato: ['Chemkin', 'LabVIEW'],
    richiedeAbilitazione: true,
    durataMinimaMinuti: 120,
    durataMassimaMinuti: 240
  },
  {
    codice: 'DEI-AROB',
    nome: 'Automation and Robotics Lab',
    edificio: 'DEI',
    piano: 1,
    capienza: 25,
    dipartimento: 'DEI',
    numeroPostazioni: 20,
    softwareInstallato: ['MATLAB', 'Simulink', 'ROS 2'],
    richiedeAbilitazione: true,
    durataMinimaMinuti: 60,
    durataMassimaMinuti: 240
  },
  {
    codice: 'DEI-TELE',
    nome: 'Laboratorio Didattico di Telematica',
    edificio: 'DEI',
    piano: 1,
    capienza: 30,
    dipartimento: 'DEI',
    numeroPostazioni: 30,
    softwareInstallato: ['Wireshark', 'GNS3', 'Cisco Packet Tracer'],
    richiedeAbilitazione: false,
    durataMinimaMinuti: 60,
    durataMassimaMinuti: 240
  },
  {
    codice: 'DEI-PRIN',
    nome: 'PrinceLab',
    edificio: 'DEI',
    piano: 2,
    capienza: 18,
    dipartimento: 'DEI',
    numeroPostazioni: 14,
    softwareInstallato: ['MATLAB', 'Python', 'TensorFlow'],
    richiedeAbilitazione: true,
    durataMinimaMinuti: 60,
    durataMassimaMinuti: 240
  },
  {
    codice: 'DICA-PMSA',
    nome: 'Laboratorio Prove Materiali "M. Salvati"',
    edificio: 'DICATECh',
    piano: 0,
    capienza: 20,
    dipartimento: 'DICATECh',
    numeroPostazioni: 10,
    softwareInstallato: ['Bluehill Universal', 'AutoCAD'],
    richiedeAbilitazione: true,
    durataMinimaMinuti: 120,
    durataMassimaMinuti: 240
  },
  {
    codice: 'DICA-GEOT',
    nome: 'Laboratorio di Ingegneria Geotecnica',
    edificio: 'DICATECh',
    piano: -1,
    capienza: 16,
    dipartimento: 'DICATECh',
    numeroPostazioni: 8,
    softwareInstallato: ['Plaxis', 'GeoStudio'],
    richiedeAbilitazione: true,
    durataMinimaMinuti: 120,
    durataMassimaMinuti: 240
  },
  {
    codice: 'ARCOD-FABL',
    nome: 'FabLab Poliba',
    edificio: 'ArCoD',
    piano: 0,
    capienza: 24,
    dipartimento: 'ArCoD',
    numeroPostazioni: 16,
    softwareInstallato: ['Rhinoceros', 'Grasshopper', 'Cura'],
    richiedeAbilitazione: false,
    durataMinimaMinuti: 60,
    durataMassimaMinuti: 180
  }
];

const AULE = [
  {
    codice: 'AULA-A1',
    nome: 'Aula A1',
    edificio: 'Corpo aule Nord',
    piano: 0,
    capienza: 120,
    tipoAula: 'didattica',
    haProiettore: true,
    haLavagnaInterattiva: true
  },
  {
    codice: 'AULA-A2',
    nome: 'Aula A2',
    edificio: 'Corpo aule Nord',
    piano: 0,
    capienza: 90,
    tipoAula: 'didattica',
    haProiettore: true,
    haLavagnaInterattiva: false
  },
  {
    codice: 'AULA-B3',
    nome: 'Aula B3',
    edificio: 'Corpo aule Sud',
    piano: 1,
    capienza: 60,
    tipoAula: 'didattica',
    haProiettore: true,
    haLavagnaInterattiva: false
  },
  {
    codice: 'AULA-DEI1',
    nome: 'Aula DEI 1',
    edificio: 'DEI',
    piano: 0,
    capienza: 80,
    tipoAula: 'didattica',
    haProiettore: true,
    haLavagnaInterattiva: true
  },
  {
    codice: 'STUDIO-BIB',
    nome: 'Sala studio Biblioteca centrale',
    edificio: 'Biblioteca',
    piano: 0,
    capienza: 40,
    tipoAula: 'studio',
    haProiettore: false,
    haLavagnaInterattiva: false,
    durataMinimaMinuti: 60,
    durataMassimaMinuti: 240
  },
  {
    codice: 'STUDIO-QUAD',
    nome: 'Sala studio Quadrilatero',
    edificio: 'Quadrilatero',
    piano: 1,
    capienza: 30,
    tipoAula: 'studio',
    haProiettore: false,
    haLavagnaInterattiva: false,
    durataMinimaMinuti: 60,
    durataMassimaMinuti: 180
  }
];

async function svuota() {
  await Promise.all([
    Utente.deleteMany({}),
    RisorsaPrenotabile.deleteMany({}),
    Prenotazione.deleteMany({}),
    Occupazione.deleteMany({}),
    Configurazione.deleteMany({})
  ]);
}

async function creaUtente(nome, cognome, email, ruolo) {
  return Utente.create({
    nome,
    cognome,
    email,
    passwordHash: await Utente.calcolaHashPassword(PASSWORD_DI_ESEMPIO),
    ruolo
  });
}

async function popola() {
  await svuota();

  await Configurazione.create({ chiave: 'globale' });

  const laboratori = await Laboratorio.insertMany(LABORATORI);
  await Aula.insertMany(AULE);

  await creaUtente('Marina', 'Mongiello', 'amministratore@poliba.it', 'amministratore');
  await creaUtente('Giuseppe', 'De Santis', 'g.desantis@poliba.it', 'docente');
  await creaUtente('Anna', 'Loiacono', 'a.loiacono@poliba.it', 'docente');

  // Tre studenti, di cui uno solo abilitato a un laboratorio ad accesso controllato:
  // la differenza serve a mostrare in sede di prova il controllo di abilitazione.
  const laboratorioControllato = laboratori.find(
    (laboratorio) => laboratorio.codice === 'DEI-AROB'
  );

  const studenteAbilitato = await creaUtente(
    'Luca',
    'Ferrara',
    'l.ferrara@poliba.it',
    'studente'
  );
  studenteAbilitato.abilitazioniLaboratori.push(laboratorioControllato._id);
  await studenteAbilitato.save();

  await creaUtente('Sara', 'Colella', 's.colella@poliba.it', 'studente');
  await creaUtente('Davide', 'Rizzo', 'd.rizzo@poliba.it', 'studente');

  console.log('Database popolato:');
  console.log(`  laboratori: ${LABORATORI.length}`);
  console.log(`  aule: ${AULE.length}`);
  console.log('  utenti: 1 amministratore, 2 docenti, 3 studenti');
  console.log(`  password comune agli utenti di esempio: ${PASSWORD_DI_ESEMPIO}`);
  console.log(
    `  studente abilitato al laboratorio ${laboratorioControllato.codice}: ${studenteAbilitato.email}`
  );
}

async function esegui() {
  const urlMongo = process.env.MONGO_URL || 'mongodb://localhost:27017/aulalibera';

  await mongoose.connect(urlMongo);
  try {
    await popola();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  esegui().catch((errore) => {
    console.error('Popolamento non riuscito:', errore);
    process.exit(1);
  });
}

module.exports = { popola, esegui, PASSWORD_DI_ESEMPIO, LABORATORI, AULE };
