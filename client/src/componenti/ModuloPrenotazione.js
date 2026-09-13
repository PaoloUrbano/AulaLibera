import React, { useEffect, useState } from 'react';

import Avviso from './Avviso';
import GrigliaOraria from './GrigliaOraria';
import { formattaDurata, formattaOra } from '../formato';
import { prenotazioni, risorse as apiRisorse } from '../servizi/api';

const MILLISECONDI_IN_UN_MINUTO = 60 * 1000;

function componiIstante(giorno, orario) {
  const [anno, mese, numeroGiorno] = giorno.split('-').map(Number);
  const [ore, minuti] = orario.split(':').map(Number);
  return new Date(anno, mese - 1, numeroGiorno, ore, minuti, 0, 0);
}

// una fascia per ogni intervallo fra apertura e chiusura; l'ultima finisce alla chiusura
function costruisciFasce(configurazione, giorno, slotOccupati) {
  const apertura = componiIstante(giorno, configurazione.orarioApertura);
  const chiusura = componiIstante(giorno, configurazione.orarioChiusura);
  const passo = configurazione.durataSlotMinuti * MILLISECONDI_IN_UN_MINUTO;

  const occupati = new Set(
    slotOccupati.map((istante) => new Date(istante).getTime())
  );
  const adesso = Date.now();

  const fasce = [];
  for (
    let istante = apertura.getTime();
    istante + passo <= chiusura.getTime();
    istante += passo
  ) {
    const inizio = new Date(istante);
    fasce.push({
      inizio,
      oraInizio: formattaOra(istante),
      oraFine: formattaOra(istante + passo),
      iniziaOra: inizio.getMinutes() === 0,
      occupato: occupati.has(istante),
      passato: istante < adesso
    });
  }
  return fasce;
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

  const slotMinimi = Math.ceil(risorsa.durataMinimaMinuti / passoMinuti);
  const slotMassimi = Math.floor(risorsa.durataMassimaMinuti / passoMinuti);

  const fasce = costruisciFasce(configurazione, giorno, slotOccupati);

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

  const durataScelta =
    selezione.inizio === null ? 0 : (selezione.fine - selezione.inizio) * passoMinuti;
  const istanteInizio =
    selezione.inizio === null ? null : fasce[selezione.inizio].inizio;
  const istanteFine =
    selezione.inizio === null
      ? null
      : new Date(
          fasce[selezione.fine - 1].inizio.getTime() +
            passoMinuti * MILLISECONDI_IN_UN_MINUTO
        );

  async function invia(evento) {
    evento.preventDefault();
    impostaErrore('');
    impostaSuccesso('');

    if (selezione.inizio === null) {
      impostaErrore("Scegli prima l'orario sulla griglia della giornata.");
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
        `Prenotato dalle ${formattaOra(istanteInizio)} alle ${formattaOra(istanteFine)}`
      );
      impostaSelezione({ inizio: null, fine: null });
      impostaMotivazione('');
      if (onPrenotata) {
        onPrenotata();
      }
    } catch (problema) {
      // 409: qualcuno ha prenotato nel frattempo, la griglia va ricaricata
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

  // può succedere se l'amministratore imposta durate incompatibili con lo slot
  // (es. slot da 45' e massimo 60'): meglio dirlo che mostrare una griglia tutta spenta
  if (slotMassimi < slotMinimi) {
    return (
      <div className="riquadro">
        <h2>Prenota {risorsa.nome}</h2>
        <p className="regola">
          Questa risorsa al momento non è prenotabile: la durata ammessa va da{' '}
          {formattaDurata(risorsa.durataMinimaMinuti)} a{' '}
          {formattaDurata(risorsa.durataMassimaMinuti)}, ma la giornata è divisa in fasce
          da {passoMinuti} minuti e nessuna durata valida ci rientra. Occorre segnalarlo
          all'amministratore.
        </p>
      </div>
    );
  }

  return (
    <div className="riquadro">
      <h2>Prenota {risorsa.nome}</h2>

      <p className="regola">
        Puoi prenotare da un minimo di{' '}
        <strong>{formattaDurata(risorsa.durataMinimaMinuti)}</strong> a un massimo di{' '}
        <strong>{formattaDurata(risorsa.durataMassimaMinuti)}</strong>, in fasce di{' '}
        {passoMinuti} minuti.
      </p>

      <GrigliaOraria
        fasce={fasce}
        orarioChiusura={configurazione.orarioChiusura}
        selezione={selezione}
        minimo={slotMinimi}
        massimo={slotMassimi}
        durataMinimaMinuti={risorsa.durataMinimaMinuti}
        onSelezione={impostaSelezione}
        onAvviso={impostaErrore}
      />

      <p className="riepilogo">
        {selezione.inizio === null ? (
          <>
            Fai clic sull'ora di inizio: la prenotazione parte subito con la durata minima
            di {formattaDurata(risorsa.durataMinimaMinuti)}. Un secondo clic più in basso
            la allunga fino a quell'orario.
          </>
        ) : (
          <>
            Prenoti{' '}
            <strong>
              dalle {formattaOra(istanteInizio)} alle {formattaOra(istanteFine)}
            </strong>{' '}
            — {formattaDurata(durataScelta)}
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
