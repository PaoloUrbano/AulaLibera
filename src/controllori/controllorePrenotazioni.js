const servizioPrenotazioni = require('../servizi/servizioPrenotazioni');

async function crea(richiesta, risposta) {
  const prenotazione = await servizioPrenotazioni.creaPrenotazione(
    richiesta.utente,
    {
      idRisorsa: richiesta.body.idRisorsa,
      dataOraInizio: richiesta.body.dataOraInizio,
      dataOraFine: richiesta.body.dataOraFine,
      motivazione: richiesta.body.motivazione
    }
  );

  risposta.status(201).json({ prenotazione });
}

// Le proprie prenotazioni: l'identificativo dell'utente viene dal token, mai dalla
// richiesta, altrimenti sarebbe sufficiente cambiarlo per leggere quelle altrui.
async function mie(richiesta, risposta) {
  const prenotazioni = await servizioPrenotazioni.elencaPrenotazioniUtente(
    richiesta.utente._id,
    richiesta.query
  );
  risposta.json({ prenotazioni });
}

async function tutte(richiesta, risposta) {
  const prenotazioni = await servizioPrenotazioni.elencaTuttePrenotazioni(
    richiesta.query
  );
  risposta.json({ prenotazioni });
}

async function annulla(richiesta, risposta) {
  const prenotazione = await servizioPrenotazioni.annullaPrenotazione(
    richiesta.params.id,
    richiesta.utente
  );
  risposta.json({ prenotazione });
}

async function cambiaStato(richiesta, risposta) {
  const prenotazione = await servizioPrenotazioni.cambiaStato(
    richiesta.params.id,
    richiesta.body.stato,
    richiesta.utente
  );
  risposta.json({ prenotazione });
}

module.exports = { crea, mie, tutte, annulla, cambiaStato };
