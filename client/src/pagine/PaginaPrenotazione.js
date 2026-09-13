import React, { useCallback, useEffect, useState } from 'react';

import Avviso from '../componenti/Avviso';
import ElencoRisorse from '../componenti/ElencoRisorse';
import ModuloPrenotazione from '../componenti/ModuloPrenotazione';
import { configurazione as apiConfigurazione, risorse as apiRisorse } from '../servizi/api';

const DIPARTIMENTI = ['DMMM', 'DEI', 'DICATECh', 'ArCoD'];

function oggi() {
  const adesso = new Date();
  const mese = String(adesso.getMonth() + 1).padStart(2, '0');
  const giorno = String(adesso.getDate()).padStart(2, '0');
  return `${adesso.getFullYear()}-${mese}-${giorno}`;
}

// stessa pagina per studente e docente: cambia solo l'elenco che arriva dal backend
export default function PaginaPrenotazione() {
  const [filtri, impostaFiltri] = useState({
    tipoRisorsa: '',
    tipoAula: '',
    dipartimento: '',
    giorno: oggi(),
    oraInizio: '',
    oraFine: ''
  });

  const [risorse, impostaRisorse] = useState([]);
  const [selezionata, impostaSelezionata] = useState(null);
  const [configurazione, impostaConfigurazione] = useState(null);
  const [errore, impostaErrore] = useState('');

  useEffect(() => {
    apiConfigurazione
      .ottieni()
      .then((risposta) => impostaConfigurazione(risposta.configurazione))
      .catch((problema) => impostaErrore(problema.message));
  }, []);

  const caricaRisorse = useCallback(async () => {
    impostaErrore('');
    try {
      const risposta = await apiRisorse.elenca(filtri);
      impostaRisorse(risposta.risorse);

      // se la risorsa scelta è sparita dall'elenco, la selezione decade
      impostaSelezionata((precedente) =>
        precedente &&
        risposta.risorse.some((risorsa) => risorsa._id === precedente._id)
          ? precedente
          : null
      );
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }, [filtri]);

  useEffect(() => {
    caricaRisorse();
  }, [caricaRisorse]);

  function aggiornaFiltro(campo, valore) {
    impostaFiltri((precedenti) => ({ ...precedenti, [campo]: valore }));
  }

  return (
    <section>
      <h1>Risorse prenotabili</h1>

      <div className="riquadro filtri">
        <div className="riga">
          <label>
            Tipo
            <select
              value={filtri.tipoRisorsa}
              onChange={(evento) => aggiornaFiltro('tipoRisorsa', evento.target.value)}
            >
              <option value="">Tutte</option>
              <option value="Aula">Aule</option>
              <option value="Laboratorio">Laboratori</option>
            </select>
          </label>

          <label>
            Tipo di aula
            <select
              value={filtri.tipoAula}
              onChange={(evento) => aggiornaFiltro('tipoAula', evento.target.value)}
              disabled={filtri.tipoRisorsa === 'Laboratorio'}
            >
              <option value="">Tutte</option>
              <option value="didattica">Didattica</option>
              <option value="studio">Studio</option>
            </select>
          </label>

          <label>
            Dipartimento
            <select
              value={filtri.dipartimento}
              onChange={(evento) => aggiornaFiltro('dipartimento', evento.target.value)}
              disabled={filtri.tipoRisorsa === 'Aula'}
            >
              <option value="">Tutti</option>
              {DIPARTIMENTI.map((dipartimento) => (
                <option key={dipartimento} value={dipartimento}>
                  {dipartimento}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="riga">
          <label>
            Giorno
            <input
              type="date"
              value={filtri.giorno}
              onChange={(evento) => aggiornaFiltro('giorno', evento.target.value)}
            />
          </label>

          <label>
            Libere dalle
            <input
              type="time"
              value={filtri.oraInizio}
              onChange={(evento) => aggiornaFiltro('oraInizio', evento.target.value)}
            />
          </label>

          <label>
            Alle
            <input
              type="time"
              value={filtri.oraFine}
              onChange={(evento) => aggiornaFiltro('oraFine', evento.target.value)}
            />
          </label>
        </div>
      </div>

      <Avviso errore={errore} />

      <div className="due-colonne">
        <ElencoRisorse
          risorse={risorse}
          selezionata={selezionata}
          onSeleziona={impostaSelezionata}
        />

        {selezionata && configurazione ? (
          <ModuloPrenotazione
            key={`${selezionata._id}-${filtri.giorno}`}
            risorsa={selezionata}
            configurazione={configurazione}
            giorno={filtri.giorno}
            onPrenotata={caricaRisorse}
          />
        ) : (
          <p className="vuoto">Scegli una risorsa per prenotarla.</p>
        )}
      </div>
    </section>
  );
}
