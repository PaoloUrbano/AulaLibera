import React, { useCallback, useEffect, useState } from 'react';

import Avviso from '../componenti/Avviso';
import { prenotazioni as apiPrenotazioni } from '../servizi/api';

export function formattaIntervallo(dataOraInizio, dataOraFine) {
  const inizio = new Date(dataOraInizio);
  const fine = new Date(dataOraFine);

  const giorno = inizio.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  const opzioni = { hour: '2-digit', minute: '2-digit' };

  return `${giorno}, ${inizio.toLocaleTimeString('it-IT', opzioni)} - ${fine.toLocaleTimeString('it-IT', opzioni)}`;
}

export default function PaginaMiePrenotazioni() {
  const [elenco, impostaElenco] = useState([]);
  const [errore, impostaErrore] = useState('');
  const [successo, impostaSuccesso] = useState('');

  const carica = useCallback(async () => {
    try {
      const risposta = await apiPrenotazioni.mie();
      impostaElenco(risposta.prenotazioni);
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }, []);

  useEffect(() => {
    carica();
  }, [carica]);

  async function annulla(identificativo) {
    impostaErrore('');
    impostaSuccesso('');
    try {
      await apiPrenotazioni.annulla(identificativo);
      impostaSuccesso('Prenotazione annullata: la fascia oraria torna disponibile');
      await carica();
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }

  return (
    <section>
      <h1>Le mie prenotazioni</h1>

      <Avviso errore={errore} successo={successo} />

      {elenco.length === 0 ? (
        <p className="vuoto">Non hai ancora effettuato prenotazioni.</p>
      ) : (
        <table className="tabella">
          <thead>
            <tr>
              <th>Risorsa</th>
              <th>Quando</th>
              <th>Motivazione</th>
              <th>Stato</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {elenco.map((prenotazione) => (
              <tr key={prenotazione._id}>
                <td>
                  {prenotazione.risorsa.nome}
                  <span className="codice">{prenotazione.risorsa.codice}</span>
                </td>
                <td>
                  {formattaIntervallo(
                    prenotazione.dataOraInizio,
                    prenotazione.dataOraFine
                  )}
                </td>
                <td>{prenotazione.motivazione || '-'}</td>
                <td>{prenotazione.stato}</td>
                <td>
                  {prenotazione.stato !== 'annullata' &&
                    prenotazione.stato !== 'conclusa' && (
                      <button type="button" onClick={() => annulla(prenotazione._id)}>
                        Annulla
                      </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
