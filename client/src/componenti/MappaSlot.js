import React, { useState } from 'react';

import { formattaDurata } from '../formato';

// Mappa della giornata: una casella per ogni intervallo prenotabile, dall'apertura alla
// chiusura. Ogni casella riporta l'ora in cui comincia e l'ora in cui finisce, perché è
// la fine a interessare chi prenota: mostrare la sola ora di inizio costringeva a fare
// mentalmente l'ultima somma, e chi voleva finire alle 11:00 doveva capire da sé di
// dover scegliere il riquadro delle 10:30.
//
// Nei testi rivolti all'utente non compaiono né "slot" né "casella": si parla soltanto
// di orari e di durate, che sono i termini in cui il problema si presenta a chi prenota.

function eDisponibile(casella) {
  return !casella.occupato && !casella.passato;
}

// L'intervallo dev'essere continuo: una prenotazione non può scavalcare un orario già
// occupato da qualcun altro.
function intervalloLibero(caselle, inizio, fine) {
  for (let indice = inizio; indice <= fine; indice += 1) {
    if (!eDisponibile(caselle[indice])) {
      return false;
    }
  }
  return true;
}

// Su quali orari la prenotazione può terminare, dato l'inizio scelto.
function fineAmmessa(caselle, inizio, indice, slotMinimi, slotMassimi) {
  if (indice < inizio) {
    return false;
  }
  const quanti = indice - inizio + 1;
  if (quanti < slotMinimi || quanti > slotMassimi) {
    return false;
  }
  return intervalloLibero(caselle, inizio, indice);
}

// Un orario è proponibile come inizio solo se da lì c'è almeno la durata minima libera
// di seguito: proporne uno senza sbocco porterebbe a una richiesta respinta.
function inizioAmmesso(caselle, indice, slotMinimi) {
  const ultimo = indice + slotMinimi - 1;
  if (ultimo >= caselle.length) {
    return false;
  }
  return intervalloLibero(caselle, indice, ultimo);
}

export default function MappaSlot({
  caselle,
  selezione,
  slotMinimi,
  slotMassimi,
  durataMinimaMinuti,
  onSelezione,
  onAvviso
}) {
  const [anteprima, impostaAnteprima] = useState(null);

  const haInizio = selezione.inizio !== null;

  function avviaSelezione(indice) {
    if (!inizioAmmesso(caselle, indice, slotMinimi)) {
      // I due motivi per cui un orario non può fare da inizio sono diversi e vanno
      // detti in modo diverso: o la giornata finisce prima, o qualcuno ha già prenotato.
      const oltreLaChiusura = indice + slotMinimi - 1 >= caselle.length;
      const durataMinima = formattaDurata(durataMinimaMinuti);

      onAvviso(
        oltreLaChiusura
          ? `Dalle ${caselle[indice].oraInizio} alla chiusura non c'è tempo per una prenotazione di almeno ${durataMinima}: scegli un orario più presto.`
          : `Dalle ${caselle[indice].oraInizio} non c'è spazio per una prenotazione di almeno ${durataMinima}: poco dopo la risorsa risulta già prenotata.`
      );
      return;
    }
    onAvviso('');
    onSelezione({ inizio: indice, fine: indice + slotMinimi });
  }

  function gestisciClic(indice) {
    if (!eDisponibile(caselle[indice])) {
      return;
    }

    if (!haInizio) {
      avviaSelezione(indice);
      return;
    }

    // Un clic sul primo orario annulla la scelta: è il modo più prevedibile per
    // ricominciare da capo.
    if (indice === selezione.inizio) {
      onAvviso('');
      onSelezione({ inizio: null, fine: null });
      return;
    }

    if (fineAmmessa(caselle, selezione.inizio, indice, slotMinimi, slotMassimi)) {
      onAvviso('');
      onSelezione({ inizio: selezione.inizio, fine: indice + 1 });
      return;
    }

    // Il clic non può spostare la fine: viene inteso come un nuovo orario di inizio.
    avviaSelezione(indice);
  }

  // Estremo finale evidenziato al passaggio del puntatore: mostra in anticipo dove
  // arriverebbe la prenotazione, senza doverlo scoprire cliccando.
  const fineAnteprima =
    haInizio &&
    anteprima !== null &&
    fineAmmessa(caselle, selezione.inizio, anteprima, slotMinimi, slotMassimi)
      ? anteprima + 1
      : null;

  function classeDi(indice) {
    const casella = caselle[indice];

    if (casella.occupato) {
      return 'casella casella-occupata';
    }
    if (casella.passato) {
      return 'casella casella-passata';
    }

    if (haInizio && indice >= selezione.inizio && indice < selezione.fine) {
      return 'casella casella-selezionata';
    }

    if (
      fineAnteprima !== null &&
      indice >= selezione.inizio &&
      indice < fineAnteprima
    ) {
      return 'casella casella-anteprima';
    }

    // Con un inizio già scelto, gli orari su cui la prenotazione non può terminare
    // vengono attenuati: il limite di durata si vede invece di doverlo ricordare.
    if (
      haInizio &&
      !fineAmmessa(caselle, selezione.inizio, indice, slotMinimi, slotMassimi)
    ) {
      return 'casella casella-inattiva';
    }

    return 'casella casella-libera';
  }

  function descrizioneDi(indice) {
    const casella = caselle[indice];
    const fascia = `dalle ${casella.oraInizio} alle ${casella.oraFine}`;

    if (casella.occupato) {
      return `${fascia}: già prenotato`;
    }
    if (casella.passato) {
      return `${fascia}: orario passato`;
    }
    return `${fascia}: libero`;
  }

  return (
    <div>
      <div className="mappa-slot" onMouseLeave={() => impostaAnteprima(null)}>
        {caselle.map((casella, indice) => (
          <button
            key={casella.oraInizio}
            type="button"
            className={classeDi(indice)}
            title={descrizioneDi(indice)}
            aria-label={descrizioneDi(indice)}
            disabled={!eDisponibile(casella)}
            onMouseEnter={() => impostaAnteprima(indice)}
            onFocus={() => impostaAnteprima(indice)}
            onClick={() => gestisciClic(indice)}
          >
            <span className="ora-inizio">{casella.oraInizio}</span>
            <span className="ora-fine">{casella.oraFine}</span>
          </button>
        ))}
      </div>

      <ul className="legenda">
        <li>
          <span className="campione casella-libera" /> libero
        </li>
        <li>
          <span className="campione casella-selezionata" /> il tuo orario
        </li>
        <li>
          <span className="campione casella-occupata" /> già prenotato
        </li>
        <li>
          <span className="campione casella-passata" /> orario passato
        </li>
        <li>
          <span className="campione casella-inattiva" /> fuori dalla durata consentita
        </li>
      </ul>
    </div>
  );
}
