const express = require('express');

const controllorePrenotazioni = require('../controllori/controllorePrenotazioni');
const verificaToken = require('../middleware/verificaToken');
const verificaRuolo = require('../middleware/verificaRuolo');
const { catturaErrori } = require('../middleware/gestoreErrori');

const rotte = express.Router();

rotte.use(verificaToken);

rotte.post(
  '/',
  verificaRuolo('studente', 'docente'),
  catturaErrori(controllorePrenotazioni.crea)
);

rotte.get('/mie', catturaErrori(controllorePrenotazioni.mie));

rotte.get(
  '/',
  verificaRuolo('amministratore'),
  catturaErrori(controllorePrenotazioni.tutte)
);

// aperto a tutti: è il servizio a controllare che sia il titolare o un amministratore
rotte.patch('/:id/annullamento', catturaErrori(controllorePrenotazioni.annulla));

rotte.patch(
  '/:id/stato',
  verificaRuolo('amministratore'),
  catturaErrori(controllorePrenotazioni.cambiaStato)
);

module.exports = rotte;
