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

const FUSO_ORARIO_ATENEO = 'Europe/Rome';

// separata dall'avvio così i test la usano con un MongoDB in memoria, senza porta
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

  applicazione.use(express.static(CARTELLA_FRONTEND));

  // i percorsi non-api li gestisce il router di React
  applicazione.get('*', (richiesta, risposta) => {
    risposta.sendFile(path.join(CARTELLA_FRONTEND, 'index.html'));
  });

  applicazione.use(gestoreErrori);

  return applicazione;
}

// in Docker il contenitore dell'api può partire prima che Mongo accetti connessioni
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

// senza l'indice univoco su Occupazione non c'è mutua esclusione: va atteso
// prima di accettare richieste
async function preparaIndici() {
  await Promise.all(
    Object.values(mongoose.models).map((modello) => modello.init())
  );
}

// Apertura e chiusura sono orari di Bari e le regole confrontano ore locali: con il
// processo in UTC le 09:00 del browser diventano le 07:00 e la prenotazione viene
// respinta. TZ è impostata nell'immagine, qui si controlla soltanto.
function verificaFusoOrario() {
  const fusoAttivo = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (fusoAttivo !== FUSO_ORARIO_ATENEO) {
    console.warn(
      `Attenzione: il server sta usando il fuso orario ${fusoAttivo} anziché ${FUSO_ORARIO_ATENEO}. ` +
        'Impostare la variabile di ambiente TZ, altrimenti gli orari di apertura e ' +
        'chiusura verranno applicati sul fuso sbagliato.'
    );
    return;
  }

  console.log(`Fuso orario del dominio: ${fusoAttivo}`);
}

async function avvia() {
  const urlMongo = process.env.MONGO_URL || 'mongodb://localhost:27017/aulalibera';
  const porta = Number(process.env.PORTA) || 3000;

  verificaFusoOrario();

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

module.exports = {
  FUSO_ORARIO_ATENEO,
  creaApplicazione,
  connettiAlDatabase,
  preparaIndici,
  verificaFusoOrario,
  avvia
};
