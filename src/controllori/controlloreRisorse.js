const servizioRisorse = require('../servizi/servizioRisorse');

async function elenca(richiesta, risposta) {
  const risorse = await servizioRisorse.elencaRisorse(
    {
      tipoRisorsa: richiesta.query.tipoRisorsa,
      tipoAula: richiesta.query.tipoAula,
      dipartimento: richiesta.query.dipartimento,
      giorno: richiesta.query.giorno,
      oraInizio: richiesta.query.oraInizio,
      oraFine: richiesta.query.oraFine,
      includiDisattivate: richiesta.query.includiDisattivate === 'true'
    },
    richiesta.utente
  );

  risposta.json({ risorse });
}

async function ottieni(richiesta, risposta) {
  const risorsa = await servizioRisorse.ottieniRisorsa(richiesta.params.id);
  risposta.json({ risorsa });
}

async function disponibilita(richiesta, risposta) {
  const disponibilitaRisorsa = await servizioRisorse.slotOccupati(
    richiesta.params.id,
    richiesta.query.giorno
  );
  risposta.json(disponibilitaRisorsa);
}

async function crea(richiesta, risposta) {
  const risorsa = await servizioRisorse.creaRisorsa(richiesta.body);
  risposta.status(201).json({ risorsa });
}

async function aggiorna(richiesta, risposta) {
  const risorsa = await servizioRisorse.aggiornaRisorsa(
    richiesta.params.id,
    richiesta.body
  );
  risposta.json({ risorsa });
}

async function attivazione(richiesta, risposta) {
  const risorsa = await servizioRisorse.impostaAttivazione(
    richiesta.params.id,
    Boolean(richiesta.body.attiva)
  );
  risposta.json({ risorsa });
}

async function elimina(richiesta, risposta) {
  await servizioRisorse.eliminaRisorsa(richiesta.params.id);
  risposta.status(204).end();
}

async function elencaStudenti(richiesta, risposta) {
  const studenti = await servizioRisorse.elencaStudenti();
  risposta.json({
    studenti: studenti.map((studente) => ({
      ...studente.versionePubblica(),
      abilitazioniLaboratori: studente.abilitazioniLaboratori
    }))
  });
}

async function abilitazione(richiesta, risposta) {
  const studente = await servizioRisorse.impostaAbilitazione(
    richiesta.params.idStudente,
    richiesta.params.idLaboratorio,
    Boolean(richiesta.body.abilitato)
  );
  risposta.json({ studente: studente.versionePubblica() });
}

module.exports = {
  elenca,
  ottieni,
  disponibilita,
  crea,
  aggiorna,
  attivazione,
  elimina,
  elencaStudenti,
  abilitazione
};
