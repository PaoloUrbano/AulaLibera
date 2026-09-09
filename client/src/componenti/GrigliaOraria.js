import React, { Fragment, useState } from 'react';

import { formattaDurata } from '../formato';

// Griglia oraria della giornata, costruita sull'impianto della vista giorno dei
// calendari: una colonna di marcatori orari e, accanto, una banda per ogni intervallo
// prenotabile, alta in proporzione alla durata.
//
// La scelta che conta è dove stanno scritti gli orari. Etichettare ogni riquadro con la
// propria ora di inizio obbligava a un passaggio mentale — la fascia marcata 10:30
// arriva fino alle 11:00, quindi per finire alle 11:00 devo scegliere quella —, mentre
// scrivere gli orari sulle linee di separazione li rende quello che sono: confini. La
// selezione si vede allora cominciare su una linea e terminare su un'altra, e l'ora di
// fine è leggibile senza calcoli.
//
// Nei testi rivolti a chi prenota non compaiono né "slot" né "casella": si parla solo di
// orari e durate, che sono i termini in cui il problema si presenta all'utente.

function eDisponibile(fascia) {
  return !fascia.occupato && !fascia.passato;
}

// La prenotazione dev'essere continua: non può scavalcare un orario già occupato.
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

// Un orario può fare da inizio solo se da lì c'è almeno la durata minima libera di
// seguito: proporne uno senza sbocco porterebbe a una richiesta respinta.
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
      // I due motivi per cui un orario non può fare da inizio sono diversi e vanno detti
      // in modo diverso: o la giornata finisce prima, o qualcuno ha già prenotato.
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

    // Un clic sulla prima fascia annulla la scelta: è il modo più prevedibile per
    // ricominciare da capo.
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

  // Fine che si otterrebbe fermandosi dove si trova il puntatore: mostra in anticipo
  // dove arriverebbe la prenotazione, senza doverlo scoprire cliccando.
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

  // Testo scritto dentro la banda. Resta quasi sempre vuoto: gli orari li portano i
  // marcatori, e riempire ogni banda renderebbe illeggibile la giornata. Compare dove
  // serve una conferma — sulla fascia scelta — o una spiegazione — sul primo intervallo
  // di una serie occupata.
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
            {/* Il marcatore compare a ogni ora piena e viene collocato sulla linea che
                separa le due bande, non dentro l'una o l'altra. */}
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

        {/* Ultima linea della giornata: senza questo marcatore l'orario di chiusura
            resterebbe l'unico confine non scritto, proprio quello su cui termina una
            prenotazione fatta a fine giornata. */}
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
