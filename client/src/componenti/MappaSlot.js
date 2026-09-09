import React, { useState } from 'react';

import { formattaCaselle } from '../formato';

// Mappa della giornata: una casella per ogni slot, dall'orario di apertura a quello di
// chiusura. Mostrare le caselle invece di elencare a parole gli orari occupati rende
// immediatamente visibile che cosa è libero, e soprattutto rende visibili i vincoli:
// quante caselle servono al minimo, quante se ne possono prendere al massimo, e dove la
// continuità si interrompe perché qualcun altro ha già prenotato.

// Una casella è cliccabile solo se non è occupata e non appartiene al passato.
function eDisponibile(casella) {
  return !casella.occupato && !casella.passato;
}

// Verifica che l'intervallo [inizio, fine] sia interamente libero: la prenotazione deve
// essere continua, non può scavalcare uno slot occupato.
function intervalloLibero(caselle, inizio, fine) {
  for (let indice = inizio; indice <= fine; indice += 1) {
    if (!eDisponibile(caselle[indice])) {
      return false;
    }
  }
  return true;
}

// Indici su cui la selezione può terminare, dato un inizio: rispettano la continuità e
// le durate minima e massima della risorsa.
function fineAmmessa(caselle, inizio, indice, slotMinimi, slotMassimi) {
  if (indice < inizio) {
    return false;
  }
  const quante = indice - inizio + 1;
  if (quante < slotMinimi || quante > slotMassimi) {
    return false;
  }
  return intervalloLibero(caselle, inizio, indice);
}

// Un inizio è proponibile solo se da lì partono almeno slotMinimi caselle libere
// consecutive: proporre un inizio senza sbocco porterebbe a una richiesta respinta.
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
  onSelezione,
  onAvviso
}) {
  const [anteprima, impostaAnteprima] = useState(null);

  const haInizio = selezione.inizio !== null;

  function avviaSelezione(indice) {
    if (!inizioAmmesso(caselle, indice, slotMinimi)) {
      onAvviso(
        `Da qui non partono ${formattaCaselle(slotMinimi)} libere consecutive: scegli un altro inizio.`
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

    // Un clic sull'inizio annulla la selezione: è il modo più prevedibile per ricominciare.
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

    // Il clic non può estendere la selezione corrente: viene inteso come un nuovo inizio.
    avviaSelezione(indice);
  }

  // Estremo finale evidenziato mentre il puntatore si muove: mostra in anticipo che cosa
  // si otterrebbe con il clic, senza doverlo eseguire.
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

    const dentroSelezione =
      haInizio && indice >= selezione.inizio && indice < selezione.fine;
    if (dentroSelezione) {
      return 'casella casella-selezionata';
    }

    const dentroAnteprima =
      fineAnteprima !== null &&
      indice >= selezione.inizio &&
      indice < fineAnteprima;
    if (dentroAnteprima) {
      return 'casella casella-anteprima';
    }

    // Con un inizio già scelto, le caselle che non possono chiudere la selezione
    // vengono attenuate: il vincolo di durata si vede, non va ricordato.
    if (haInizio && !fineAmmessa(caselle, selezione.inizio, indice, slotMinimi, slotMassimi)) {
      return 'casella casella-inattiva';
    }

    return 'casella casella-libera';
  }

  function descrizioneDi(indice) {
    const casella = caselle[indice];
    if (casella.occupato) {
      return `${casella.etichetta}: già prenotata`;
    }
    if (casella.passato) {
      return `${casella.etichetta}: orario trascorso`;
    }
    return `${casella.etichetta}: libera`;
  }

  return (
    <div>
      <div className="mappa-slot" onMouseLeave={() => impostaAnteprima(null)}>
        {caselle.map((casella, indice) => (
          <button
            key={casella.etichetta}
            type="button"
            className={classeDi(indice)}
            title={descrizioneDi(indice)}
            aria-label={descrizioneDi(indice)}
            disabled={!eDisponibile(casella)}
            onMouseEnter={() => impostaAnteprima(indice)}
            onFocus={() => impostaAnteprima(indice)}
            onClick={() => gestisciClic(indice)}
          >
            {casella.etichetta}
          </button>
        ))}
      </div>

      <ul className="legenda">
        <li>
          <span className="campione casella-libera" /> libera
        </li>
        <li>
          <span className="campione casella-selezionata" /> selezionata
        </li>
        <li>
          <span className="campione casella-occupata" /> già prenotata
        </li>
        <li>
          <span className="campione casella-passata" /> orario trascorso
        </li>
        <li>
          <span className="campione casella-inattiva" /> non compatibile con le durate
        </li>
      </ul>
    </div>
  );
}
