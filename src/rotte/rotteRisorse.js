const express = require('express');

const controlloreRisorse = require('../controllori/controlloreRisorse');
const verificaToken = require('../middleware/verificaToken');
const verificaRuolo = require('../middleware/verificaRuolo');
const { catturaErrori } = require('../middleware/gestoreErrori');

const rotte = express.Router();

// Ogni rotta richiede un'identità: non esiste consultazione anonima del patrimonio aule.
rotte.use(verificaToken);

// Le rotte delle abilitazioni precedono quelle con parametro :id, altrimenti Express
// interpreterebbe "abilitazioni" come identificativo di una risorsa.
rotte.get(
  '/abilitazioni/studenti',
  verificaRuolo('amministratore'),
  catturaErrori(controlloreRisorse.elencaStudenti)
);
rotte.put(
  '/abilitazioni/:idStudente/:idLaboratorio',
  verificaRuolo('amministratore'),
  catturaErrori(controlloreRisorse.abilitazione)
);

rotte.get('/', catturaErrori(controlloreRisorse.elenca));
rotte.get('/:id', catturaErrori(controlloreRisorse.ottieni));
rotte.get('/:id/disponibilita', catturaErrori(controlloreRisorse.disponibilita));

// Gestione del patrimonio: riservata all'amministratore.
rotte.post(
  '/',
  verificaRuolo('amministratore'),
  catturaErrori(controlloreRisorse.crea)
);
rotte.put(
  '/:id',
  verificaRuolo('amministratore'),
  catturaErrori(controlloreRisorse.aggiorna)
);
rotte.patch(
  '/:id/attivazione',
  verificaRuolo('amministratore'),
  catturaErrori(controlloreRisorse.attivazione)
);
rotte.delete(
  '/:id',
  verificaRuolo('amministratore'),
  catturaErrori(controlloreRisorse.elimina)
);

module.exports = rotte;
