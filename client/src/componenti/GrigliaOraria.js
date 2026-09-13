import React, { Fragment, useState } from 'react';

import { formattaDurata } from '../formato';

// Vista giorno: marcatori orari a sinistra e una banda per ogni fascia. Gli orari
// stanno sulle linee di separazione e non dentro le bande, come nei calendari:
// così la selezione si vede iniziare su un orario e finire su un altro, e non
// serve dedurre che la banda "10:30" arriva in realtà alle 11:00.
//
// I testi per l'utente parlano solo di orari e durate, mai di slot o bande.

function eDisponibile(fascia) {
  return !fascia.occupato && !fascia.passato;
}

function intervalloLibero(fasce, inizio, fine) {
  for (let indice = inizio; indice <= fine; indice += 1) {
    if (!eDisponibile(fasce[indice])) {
      return false;
    }
  }
  return true;
}

function fineAmmessa(fasce, inizio, indice, minimo, massimo) {
  if (indice < inizio) {
    return false;
  }
  const quante = indice - inizio + 1;
  if (quante < minimo || quante > massimo) {
    return false;
  }
  return intervalloLibero(fasce, inizio, indice);
}

// un inizio va proposto solo se da lì c'è la durata minima libera di seguito
function inizioAmmesso(fasce, indice, minimo) {
  const ultimo = indice + minimo - 1;
  return ultimo < fasce.length && intervalloLibero(fasce, indice, ultimo);
}

export default function GrigliaOraria({
  fasce,
  orarioChiusura,
  selezione,
  minimo,
  massimo,
  durataMinimaMinuti,
  onSelezione,
  onAvviso
}) {
  const [anteprima, impostaAnteprima] = useState(null);

  const haInizio = selezione.inizio !== null;

  function avviaSelezione(indice) {
    if (!inizioAmmesso(fasce, indice, minimo)) {
      const oltreLaChiusura = indice + minimo - 1 >= fasce.length;
      const durataMinima = formattaDurata(durataMinimaMinuti);

      onAvviso(
        oltreLaChiusura
          ? `Dalle ${fasce[indice].oraInizio} alla chiusura non c'è tempo per una prenotazione di almeno ${durataMinima}: scegli un orario più presto.`
          : `Dalle ${fasce[indice].oraInizio} non c'è spazio per una prenotazione di almeno ${durataMinima}: poco dopo la risorsa risulta già prenotata.`
      );
      return;
    }
    onAvviso('');
    onSelezione({ inizio: indice, fine: indice + minimo });
  }

  function gestisciClic(indice) {
    if (!eDisponibile(fasce[indice])) {
      return;
    }

    if (!haInizio) {
      avviaSelezione(indice);
      return;
    }

    // clic sull'inizio = annulla la scelta
    if (indice === selezione.inizio) {
      onAvviso('');
      onSelezione({ inizio: null, fine: null });
      return;
    }

    if (fineAmmessa(fasce, selezione.inizio, indice, minimo, massimo)) {
      onAvviso('');
      onSelezione({ inizio: selezione.inizio, fine: indice + 1 });
      return;
    }

    avviaSelezione(indice);
  }

  // anteprima della fine mentre il puntatore si muove
  const fineAnteprima =
    haInizio &&
    anteprima !== null &&
    fineAmmessa(fasce, selezione.inizio, anteprima, minimo, massimo)
      ? anteprima + 1
      : null;

  const finePresunta = fineAnteprima === null ? selezione.fine : fineAnteprima;

  function classeDi(indice) {
    const fascia = fasce[indice];
    const base = fascia.iniziaOra ? 'banda banda-ora' : 'banda';
    const ultima = indice === fasce.length - 1 ? ' banda-ultima' : '';

    if (fascia.occupato) {
      return `${base}${ultima} banda-occupata`;
    }
    if (fascia.passato) {
      return `${base}${ultima} banda-passata`;
    }

    if (haInizio && indice >= selezione.inizio && indice < selezione.fine) {
      return `${base}${ultima} banda-selezionata`;
    }
    if (
      fineAnteprima !== null &&
      indice >= selezione.inizio &&
      indice < fineAnteprima
    ) {
      return `${base}${ultima} banda-anteprima`;
    }
    if (haInizio && !fineAmmessa(fasce, selezione.inizio, indice, minimo, massimo)) {
      return `${base}${ultima} banda-inattiva`;
    }

    return `${base}${ultima} banda-libera`;
  }

  // testo dentro la banda: solo sulla fascia scelta e all'inizio di una serie occupata,
  // altrimenti la giornata diventa illeggibile
  function testoDi(indice) {
    const fascia = fasce[indice];

    if (fascia.occupato) {
      const primaDellaSerie = indice === 0 || !fasce[indice - 1].occupato;
      return primaDellaSerie ? 'già prenotato' : '';
    }

    if (haInizio && indice === selezione.inizio) {
      return `${fasce[selezione.inizio].oraInizio} – ${fasce[finePresunta - 1].oraFine}`;
    }

    if (!haInizio && anteprima === indice && eDisponibile(fascia)) {
      return `${fascia.oraInizio} – ${fascia.oraFine}`;
    }

    return '';
  }

  function descrizioneDi(indice) {
    const fascia = fasce[indice];
    const intervallo = `dalle ${fascia.oraInizio} alle ${fascia.oraFine}`;

    if (fascia.occupato) {
      return `${intervallo}: già prenotato`;
    }
    if (fascia.passato) {
      return `${intervallo}: orario passato`;
    }
    return `${intervallo}: libero`;
  }

  return (
    <div>
      <div className="griglia-oraria" onMouseLeave={() => impostaAnteprima(null)}>
        {fasce.map((fascia, indice) => (
          <Fragment key={fascia.oraInizio}>
            {fascia.iniziaOra && (
              <span className="marcatore" style={{ gridRow: indice + 1 }}>
                {fascia.oraInizio}
              </span>
            )}

            <button
              type="button"
              style={{ gridRow: indice + 1 }}
              className={classeDi(indice)}
              title={descrizioneDi(indice)}
              aria-label={descrizioneDi(indice)}
              disabled={!eDisponibile(fascia)}
              onMouseEnter={() => impostaAnteprima(indice)}
              onFocus={() => impostaAnteprima(indice)}
              onClick={() => gestisciClic(indice)}
            >
              <span className="etichetta-fascia">{testoDi(indice)}</span>
            </button>
          </Fragment>
        ))}

        {/* la chiusura è un confine come gli altri e va scritto anche lui */}
        <span
          className="marcatore marcatore-chiusura"
          style={{ gridRow: fasce.length + 1 }}
        >
          {orarioChiusura}
        </span>
      </div>

      <ul className="legenda">
        <li>
          <span className="campione banda-libera" /> libero
        </li>
        <li>
          <span className="campione banda-selezionata" /> il tuo orario
        </li>
        <li>
          <span className="campione banda-occupata" /> già prenotato
        </li>
        <li>
          <span className="campione banda-passata" /> orario passato
        </li>
        <li>
          <span className="campione banda-inattiva" /> fuori dalla durata consentita
        </li>
      </ul>
    </div>
  );
}
