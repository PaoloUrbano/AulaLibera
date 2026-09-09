import React, { useEffect, useState } from 'react';

import Avviso from './Avviso';
import MappaSlot from './MappaSlot';
import { formattaCaselle, formattaDurata, formattaOra } from '../formato';
import { prenotazioni, risorse as apiRisorse } from '../servizi/api';

const MILLISECONDI_IN_UN_MINUTO = 60 * 1000;

// Compone l'istante locale corrispondente a giorno e orario.
function componiIstante(giorno, orario) {
  const [anno, mese, numeroGiorno] = giorno.split('-').map(Number);
  const [ore, minuti] = orario.split(':').map(Number);
  return new Date(anno, mese - 1, numeroGiorno, ore, minuti, 0, 0);
}

// Costruisce la giornata come sequenza di caselle, una per slot, dall'apertura alla
// chiusura. L'ultima casella è quella che termina esattamente alla chiusura: uno slot
// che sforerebbe l'orario non viene proposto affatto.
function costruisciCaselle(configurazione, giorno, slotOccupati) {
  const apertura = componiIstante(giorno, configurazione.orarioApertura);
  const chiusura = componiIstante(giorno, configurazione.orarioChiusura);
  const passo = configurazione.durataSlotMinuti * MILLISECONDI_IN_UN_MINUTO;

  const occupati = new Set(
    slotOccupati.map((istante) => new Date(istante).getTime())
  );
  const adesso = Date.now();

  const caselle = [];
  for (let istante = apertura.getTime(); istante + passo <= chiusura.getTime(); istante += passo) {
    caselle.push({
      inizio: new Date(istante),
      etichetta: formattaOra(istante),
      occupato: occupati.has(istante),
      passato: istante < adesso
    });
  }
  return caselle;
}

export default function ModuloPrenotazione({
  risorsa,
  configurazione,
  giorno,
  onPrenotata
}) {
  const [slotOccupati, impostaSlotOccupati] = useState([]);
  const [selezione, impostaSelezione] = useState({ inizio: null, fine: null });
  const [motivazione, impostaMotivazione] = useState('');
  const [errore, impostaErrore] = useState('');
  const [successo, impostaSuccesso] = useState('');

  const passoMinuti = configurazione.durataSlotMinuti;

  // I vincoli della risorsa, espressi nell'unità con cui l'utente sta lavorando.
  // È il punto della schermata che scioglie l'equivoco fra la granularità dello slot e
  // la durata minima: la casella è l'unità di misura, non la durata ammessa.
  const slotMinimi = Math.ceil(risorsa.durataMinimaMinuti / passoMinuti);
  const slotMassimi = Math.floor(risorsa.durataMassimaMinuti / passoMinuti);

  const caselle = costruisciCaselle(configurazione, giorno, slotOccupati);

  useEffect(() => {
    let annullato = false;

    apiRisorse
      .disponibilita(risorsa._id, giorno)
      .then((risposta) => {
        if (!annullato) {
          impostaSlotOccupati(risposta.slot);
        }
      })
      .catch(() => impostaSlotOccupati([]));

    return () => {
      annullato = true;
    };
  }, [risorsa._id, giorno, successo]);

  const quanteSelezionate = selezione.inizio === null ? 0 : selezione.fine - selezione.inizio;
  const istanteInizio = selezione.inizio === null ? null : caselle[selezione.inizio].inizio;
  const istanteFine =
    selezione.inizio === null
      ? null
      : new Date(
          caselle[selezione.fine - 1].inizio.getTime() +
            passoMinuti * MILLISECONDI_IN_UN_MINUTO
        );

  async function invia(evento) {
    evento.preventDefault();
    impostaErrore('');
    impostaSuccesso('');

    if (selezione.inizio === null) {
      impostaErrore('Scegli la fascia oraria sulla mappa.');
      return;
    }

    try {
      await prenotazioni.crea({
        idRisorsa: risorsa._id,
        dataOraInizio: istanteInizio.toISOString(),
        dataOraFine: istanteFine.toISOString(),
        motivazione
      });

      impostaSuccesso(
        `Prenotazione registrata: ${formattaOra(istanteInizio)} - ${formattaOra(istanteFine)}`
      );
      impostaSelezione({ inizio: null, fine: null });
      impostaMotivazione('');
      if (onPrenotata) {
        onPrenotata();
      }
    } catch (problema) {
      // Il conflitto è la sola risposta che rende obsoleta la mappa mostrata: qualcuno
      // ha prenotato mentre l'utente stava scegliendo, e va ricaricata.
      if (problema.codice === 409) {
        impostaSelezione({ inizio: null, fine: null });
        const aggiornata = await apiRisorse
          .disponibilita(risorsa._id, giorno)
          .catch(() => null);
        if (aggiornata) {
          impostaSlotOccupati(aggiornata.slot);
        }
      }
      impostaErrore(problema.message);
    }
  }

  // La durata dello slot e le durate della risorsa sono impostate dall'amministratore in
  // due schermate diverse e possono risultare incompatibili: con slot da 45 minuti una
  // risorsa che ammette al massimo 60 minuti non avrebbe alcuna durata valida. Meglio
  // dirlo qui che lasciare l'utente davanti a una mappa in cui nulla è selezionabile.
  if (slotMassimi < slotMinimi) {
    return (
      <div className="riquadro">
        <h2>Prenota {risorsa.nome}</h2>
        <p className="regola">
          Questa risorsa non è prenotabile con la granularità attuale: le caselle valgono{' '}
          {passoMinuti} minuti, mentre la durata ammessa va da{' '}
          {formattaDurata(risorsa.durataMinimaMinuti)} a{' '}
          {formattaDurata(risorsa.durataMassimaMinuti)}. Occorre che l'amministratore
          allinei le durate alla durata dello slot.
        </p>
      </div>
    );
  }

  return (
    <div className="riquadro">
      <h2>Prenota {risorsa.nome}</h2>

      <p className="regola">
        Ogni casella vale <strong>{passoMinuti} minuti</strong>. Per questa risorsa la
        prenotazione deve coprire almeno{' '}
        <strong>
          {formattaCaselle(slotMinimi)} ({formattaDurata(risorsa.durataMinimaMinuti)})
        </strong>{' '}
        e al massimo{' '}
        <strong>
          {formattaCaselle(slotMassimi)} ({formattaDurata(risorsa.durataMassimaMinuti)})
        </strong>
        .
      </p>

      <MappaSlot
        caselle={caselle}
        selezione={selezione}
        slotMinimi={slotMinimi}
        slotMassimi={slotMassimi}
        onSelezione={impostaSelezione}
        onAvviso={impostaErrore}
      />

      <p className="riepilogo">
        {selezione.inizio === null ? (
          <>
            Nessuna fascia scelta. Fai clic su una casella libera: ne vengono selezionate{' '}
            {formattaCaselle(slotMinimi)}, poi un secondo clic estende la selezione.
          </>
        ) : (
          <>
            Selezione: <strong>{formattaOra(istanteInizio)} - {formattaOra(istanteFine)}</strong>{' '}
            · {formattaCaselle(quanteSelezionate)} · {formattaDurata(quanteSelezionate * passoMinuti)}
          </>
        )}
      </p>

      <form onSubmit={invia}>
        <label>
          Motivazione
          <input
            value={motivazione}
            onChange={(evento) => impostaMotivazione(evento.target.value)}
            placeholder="Esercitazione, studio individuale, lezione..."
          />
        </label>

        <Avviso errore={errore} successo={successo} />

        <button type="submit" disabled={selezione.inizio === null}>
          Conferma la prenotazione
        </button>
      </form>
    </div>
  );
}
