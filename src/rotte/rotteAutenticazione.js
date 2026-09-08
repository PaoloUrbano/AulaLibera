const express = require('express');

const controlloreAutenticazione = require('../controllori/controlloreAutenticazione');
const verificaToken = require('../middleware/verificaToken');
const { catturaErrori } = require('../middleware/gestoreErrori');

const rotte = express.Router();

rotte.post('/registrazione', catturaErrori(controlloreAutenticazione.registra));
rotte.post('/accesso', catturaErrori(controlloreAutenticazione.accedi));
rotte.post(
  '/disconnessione',
  verificaToken,
  catturaErrori(controlloreAutenticazione.esci)
);
rotte.get(
  '/profilo',
  verificaToken,
  catturaErrori(controlloreAutenticazione.profilo)
);

module.exports = rotte;
