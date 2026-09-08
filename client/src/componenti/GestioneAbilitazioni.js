import React, { useCallback, useEffect, useState } from 'react';

import Avviso from './Avviso';
import { risorse as apiRisorse } from '../servizi/api';

// Governa l'associazione fra studenti e laboratori ad accesso controllato. I laboratori
// che non richiedono abilitazione non compaiono: per essi l'associazione non ha effetto.
export default function GestioneAbilitazioni() {
  const [studenti, impostaStudenti] = useState([]);
  const [laboratori, impostaLaboratori] = useState([]);
  const [errore, impostaErrore] = useState('');
  const [successo, impostaSuccesso] = useState('');

  const carica = useCallback(async () => {
    try {
      const [rispostaStudenti, rispostaRisorse] = await Promise.all([
        apiRisorse.elencaStudenti(),
        apiRisorse.elenca({ tipoRisorsa: 'Laboratorio', includiDisattivate: true })
      ]);

      impostaStudenti(rispostaStudenti.studenti);
      impostaLaboratori(
        rispostaRisorse.risorse.filter((laboratorio) => laboratorio.richiedeAbilitazione)
      );
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }, []);

  useEffect(() => {
    carica();
  }, [carica]);

  function eAbilitato(studente, laboratorio) {
    return studente.abilitazioniLaboratori.some(
      (abilitazione) =>
        String(abilitazione._id || abilitazione) === String(laboratorio._id)
    );
  }

  async function commuta(studente, laboratorio) {
    impostaErrore('');
    impostaSuccesso('');
    try {
      await apiRisorse.abilitazione(
        studente.id,
        laboratorio._id,
        !eAbilitato(studente, laboratorio)
      );
      impostaSuccesso(`Abilitazioni di ${studente.email} aggiornate`);
      await carica();
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }

  return (
    <div>
      <h2>Abilitazioni ai laboratori</h2>

      <Avviso errore={errore} successo={successo} />

      {laboratori.length === 0 ? (
        <p className="vuoto">Nessun laboratorio richiede abilitazione.</p>
      ) : (
        <table className="tabella">
          <thead>
            <tr>
              <th>Studente</th>
              {laboratori.map((laboratorio) => (
                <th key={laboratorio._id}>{laboratorio.codice}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {studenti.map((studente) => (
              <tr key={studente.id}>
                <td>
                  {studente.nome} {studente.cognome}
                  <span className="codice">{studente.email}</span>
                </td>
                {laboratori.map((laboratorio) => (
                  <td key={laboratorio._id}>
                    <input
                      type="checkbox"
                      checked={eAbilitato(studente, laboratorio)}
                      onChange={() => commuta(studente, laboratorio)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
