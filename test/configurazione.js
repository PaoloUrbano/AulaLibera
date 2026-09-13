process.env.JWT_SEGRETO = 'segreto-di-prova';
process.env.JWT_SCADENZA = '1h';

// al primo avvio mongodb-memory-server scarica il binario di mongod
jest.setTimeout(120000);
