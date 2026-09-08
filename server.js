require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');

const rotteAutenticazione = require('./src/rotte/rotteAutenticazione');
const rotteRisorse = require('./src/rotte/rotteRisorse');
const rottePrenotazioni = require('./src/rotte/rottePrenotazioni');
const rotteConfigurazione = require('./src/rotte/rotteConfigurazione');
const { rottaNonTrovata, gestoreErrori } = require('./src/middleware/gestoreErrori');

const CARTELLA_FRONTEND = path.join(__dirname, 'client', 'build');

// La costruzione dell'applicazione è separata dall'avvio del server e dalla connessione
// al database: i test di integrazione compongono l'applicazione contro un'istanza di
// MongoDB in memoria, senza mettersi in ascolto su una porta.
function creaApplicazione() {
  const applicazione = express();

  applicazione.use(express.json());

  applicazione.get('/api/stato', (richiesta, risposta) => {
    risposta.json({ stato: 'attivo' });
  });

  applicazione.use('/api/autenticazione', rotteAutenticazione);
  applicazione.use('/api/risorse', rotteRisorse);
  applicazione.use('/api/prenotazioni', rottePrenotazioni);
  applicazione.use('/api/configurazione', rotteConfigurazione);

  applicazione.use('/api', rottaNonTrovata);

  // Il frontend compilato viene servito come file statico dallo stesso processo:
  // un solo servizio da distribuire e nessuna richiesta cross-origin da configurare.
  applicazione.use(express.static(CARTELLA_FRONTEND));

  // Le rotte del client sono gestite dal router di React: ogni percorso non riconosciuto
  // restituisce la pagina principale, che si occuperà di interpretarlo.
  applicazione.get('*', (richiesta, risposta) => {
    risposta.sendFile(path.join(CARTELLA_FRONTEND, 'index.html'));
  });

  applicazione.use(gestoreErrori);

  return applicazione;
}

// L'avvio attende che il database sia raggiungibile: in ambiente Docker il contenitore
// dell'applicazione può partire prima che MongoDB sia pronto ad accettare connessioni.
async function connettiAlDatabase(urlMongo, tentativiResidui = 10) {
  try {
    await mongoose.connect(urlMongo);
  } catch (errore) {
    if (tentativiResidui === 0) {
      throw errore;
    }
    console.log('Database non ancora raggiungibile, nuovo tentativo fra 3 secondi');
    await new Promise((risolvi) => setTimeout(risolvi, 3000));
    return connettiAlDatabase(urlMongo, tentativiResidui - 1);
  }
}

// La creazione degli indici viene attesa esplicitamente prima di accettare richieste:
// l'indice univoco su Occupazione è ciò che garantisce la mutua esclusione, e servire
// richieste prima che esista significherebbe non avere alcuna garanzia.
async function preparaIndici() {
  await Promise.all(
    Object.values(mongoose.models).map((modello) => modello.init())
  );
}

async function avvia() {
  const urlMongo = process.env.MONGO_URL || 'mongodb://localhost:27017/aulalibera';
  const porta = Number(process.env.PORTA) || 3000;

  if (!process.env.JWT_SEGRETO) {
    console.error('Variabile di ambiente JWT_SEGRETO non impostata: avvio interrotto');
    process.exit(1);
  }

  await connettiAlDatabase(urlMongo);
  await preparaIndici();

  creaApplicazione().listen(porta, () => {
    console.log(`AulaLibera in ascolto sulla porta ${porta}`);
  });
}

if (require.main === module) {
  avvia().catch((errore) => {
    console.error('Avvio non riuscito:', errore);
    process.exit(1);
  });
}

module.exports = { creaApplicazione, connettiAlDatabase, preparaIndici, avvia };
