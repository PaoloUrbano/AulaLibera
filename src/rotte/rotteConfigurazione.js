const express = require('express');

const controlloreConfigurazione = require('../controllori/controlloreConfigurazione');
const verificaToken = require('../middleware/verificaToken');
const verificaRuolo = require('../middleware/verificaRuolo');
const { catturaErrori } = require('../middleware/gestoreErrori');

const rotte = express.Router();

rotte.use(verificaToken);

rotte.get('/', catturaErrori(controlloreConfigurazione.ottieni));

rotte.put(
  '/',
  verificaRuolo('amministratore'),
  catturaErrori(controlloreConfigurazione.aggiorna)
);

module.exports = rotte;
