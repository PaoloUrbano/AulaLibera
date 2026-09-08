const express = require('express');

const controllorePrenotazioni = require('../controllori/controllorePrenotazioni');
const verificaToken = require('../middleware/verificaToken');
const verificaRuolo = require('../middleware/verificaRuolo');
const { catturaErrori } = require('../middleware/gestoreErrori');

const rotte = express.Router();

rotte.use(verificaToken);

// L'amministratore è escluso dalla creazione: per regola di dominio non prenota.
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

// L'annullamento è aperto a tutti i ruoli: il servizio verifica che chi lo richiede sia
// il titolare della prenotazione oppure un amministratore.
rotte.patch('/:id/annullamento', catturaErrori(controllorePrenotazioni.annulla));

rotte.patch(
  '/:id/stato',
  verificaRuolo('amministratore'),
  catturaErrori(controllorePrenotazioni.cambiaStato)
);

module.exports = rotte;
