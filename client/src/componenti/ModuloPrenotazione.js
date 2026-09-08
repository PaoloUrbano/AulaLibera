import React, { useEffect, useState } from 'react';

import Avviso from './Avviso';
import { prenotazioni, risorse as apiRisorse } from '../servizi/api';

// Genera gli orari selezionabili con la granularità stabilita dalla configurazione:
// proporre orari non allineati agli slot significherebbe far compilare all'utente una
// richiesta che il server rifiuterebbe.
function orariSelezionabili({ orarioApertura, orarioChiusura, durataSlotMinuti }) {
  const [oraApertura, minutiApertura] = orarioApertura.split(':').map(Number);
  const [oraChiusura, minutiChiusura] = orarioChiusura.split(':').map(Number);

  const inizio = oraApertura * 60 + minutiApertura;
  const fine = oraChiusura * 60 + minutiChiusura;

  const orari = [];
  for (let minuti = inizio; minuti <= fine; minuti += durataSlotMinuti) {
    const ore = String(Math.floor(minuti / 60)).padStart(2, '0');
    const resto = String(minuti % 60).padStart(2, '0');
    orari.push(`${ore}:${resto}`);
  }
  return orari;
}

// Compone l'istante locale corrispondente a giorno e orario scelti dall'utente.
function componiIstante(giorno, orario) {
  const [anno, mese, numeroGiorno] = giorno.split('-').map(Number);
  const [ore, minuti] = orario.split(':').map(Number);
  return new Date(anno, mese - 1, numeroGiorno, ore, minuti, 0, 0);
}

function soloOrario(istante) {
  return new Date(istante).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function ModuloPrenotazione({
  risorsa,
  configurazione,
  giorno,
  onPrenotata
}) {
  const orari = orariSelezionabili(configurazione);

  const [oraInizio, impostaOraInizio] = useState(orari[0]);
  const [oraFine, impostaOraFine] = useState(orari[Math.min(2, orari.length - 1)]);
  const [motivazione, impostaMotivazione] = useState('');
  const [occupati, impostaOccupati] = useState([]);
  const [errore, impostaErrore] = useState('');
  const [successo, impostaSuccesso] = useState('');

  // Gli slot già occupati sono mostrati prima dell'invio: è un aiuto alla scelta, non
  // una garanzia, perché un altro utente può prenotarli nel frattempo. La decisione
  // definitiva resta del server.
  useEffect(() => {
    let annullato = false;

    apiRisorse
      .disponibilita(risorsa._id, giorno)
      .then((risposta) => {
        if (!annullato) {
          impostaOccupati(risposta.slot);
        }
      })
      .catch(() => impostaOccupati([]));

    return () => {
      annullato = true;
    };
  }, [risorsa._id, giorno, successo]);

  async function invia(evento) {
    evento.preventDefault();
    impostaErrore('');
    impostaSuccesso('');

    try {
      await prenotazioni.crea({
        idRisorsa: risorsa._id,
        dataOraInizio: componiIstante(giorno, oraInizio).toISOString(),
        dataOraFine: componiIstante(giorno, oraFine).toISOString(),
        motivazione
      });

      impostaSuccesso('Prenotazione registrata');
      impostaMotivazione('');
      if (onPrenotata) {
        onPrenotata();
      }
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }

  return (
    <div className="riquadro">
      <h2>Prenota {risorsa.nome}</h2>

      <p className="dettagli">
        Slot da {configurazione.durataSlotMinuti} minuti · apertura{' '}
        {configurazione.orarioApertura} · chiusura {configurazione.orarioChiusura}
      </p>

      <p className="dettagli">
        {occupati.length === 0
          ? 'Nessuno slot risulta occupato in questa giornata.'
          : `Slot già occupati: ${occupati.map(soloOrario).join(', ')}`}
      </p>

      <form onSubmit={invia}>
        <div className="riga">
          <label>
            Dalle
            <select
              value={oraInizio}
              onChange={(evento) => impostaOraInizio(evento.target.value)}
            >
              {orari.map((orario) => (
                <option key={orario} value={orario}>
                  {orario}
                </option>
              ))}
            </select>
          </label>

          <label>
            Alle
            <select
              value={oraFine}
              onChange={(evento) => impostaOraFine(evento.target.value)}
            >
              {orari.map((orario) => (
                <option key={orario} value={orario}>
                  {orario}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Motivazione
          <input
            value={motivazione}
            onChange={(evento) => impostaMotivazione(evento.target.value)}
            placeholder="Esercitazione, studio individuale, lezione..."
          />
        </label>

        <Avviso errore={errore} successo={successo} />

        <button type="submit">Conferma la prenotazione</button>
      </form>
    </div>
  );
}
