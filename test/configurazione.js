// Variabili di ambiente necessarie ai test. Sono impostate qui e non in un file .env
// perche' i test devono poter essere eseguiti su una macchina appena clonata.
process.env.JWT_SEGRETO = 'segreto-di-prova';
process.env.JWT_SCADENZA = '1h';

// mongodb-memory-server scarica il binario di MongoDB al primo utilizzo: il tempo di
// attesa predefinito di Jest non basta.
jest.setTimeout(120000);
