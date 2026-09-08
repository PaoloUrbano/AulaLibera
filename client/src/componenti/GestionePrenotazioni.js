import React, { useCallback, useEffect, useState } from 'react';

import Avviso from './Avviso';
import { prenotazioni as apiPrenotazioni } from '../servizi/api';
import { formattaIntervallo } from '../pagine/PaginaMiePrenotazioni';

const STATI = ['richiesta', 'confermata', 'annullata', 'conclusa'];

export default function GestionePrenotazioni() {
  const [elenco, impostaElenco] = useState([]);
  const [statoFiltro, impostaStatoFiltro] = useState('');
  const [errore, impostaErrore] = useState('');
  const [successo, impostaSuccesso] = useState('');

  const carica = useCallback(async () => {
    try {
      const risposta = await apiPrenotazioni.tutte({ stato: statoFiltro });
      impostaElenco(risposta.prenotazioni);
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }, [statoFiltro]);

  useEffect(() => {
    carica();
  }, [carica]);

  async function esegui(operazione, messaggio) {
    impostaErrore('');
    impostaSuccesso('');
    try {
      await operazione();
      impostaSuccesso(messaggio);
      await carica();
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }

  return (
    <div>
      <h2>Tutte le prenotazioni</h2>

      <label>
        Filtra per stato
        <select
          value={statoFiltro}
          onChange={(evento) => impostaStatoFiltro(evento.target.value)}
        >
          <option value="">Tutti gli stati</option>
          {STATI.map((stato) => (
            <option key={stato} value={stato}>
              {stato}
            </option>
          ))}
        </select>
      </label>

      <Avviso errore={errore} successo={successo} />

      {elenco.length === 0 ? (
        <p className="vuoto">Nessuna prenotazione con questi criteri.</p>
      ) : (
        <table className="tabella">
          <thead>
            <tr>
              <th>Utente</th>
              <th>Risorsa</th>
              <th>Quando</th>
              <th>Stato</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {elenco.map((prenotazione) => (
              <tr key={prenotazione._id}>
                <td>
                  {prenotazione.utente.nome} {prenotazione.utente.cognome}
                  <span className="codice">{prenotazione.utente.email}</span>
                </td>
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
                <td>{prenotazione.stato}</td>
                <td>
                  {prenotazione.stato === 'richiesta' && (
                    <button
                      type="button"
                      onClick={() =>
                        esegui(
                          () =>
                            apiPrenotazioni.cambiaStato(
                              prenotazione._id,
                              'confermata'
                            ),
                          'Prenotazione confermata'
                        )
                      }
                    >
                      Conferma
                    </button>
                  )}

                  {prenotazione.stato !== 'annullata' &&
                    prenotazione.stato !== 'conclusa' && (
                      <button
                        type="button"
                        onClick={() =>
                          esegui(
                            () => apiPrenotazioni.annulla(prenotazione._id),
                            'Prenotazione annullata'
                          )
                        }
                      >
                        Annulla
                      </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
