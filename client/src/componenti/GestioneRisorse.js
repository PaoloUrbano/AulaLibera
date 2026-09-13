import React, { useCallback, useEffect, useState } from 'react';

import Avviso from './Avviso';
import { risorse as apiRisorse } from '../servizi/api';

const DIPARTIMENTI = ['DMMM', 'DEI', 'DICATECh', 'ArCoD'];

const CAMPI_VUOTI = {
  tipoRisorsa: 'Aula',
  codice: '',
  nome: '',
  edificio: '',
  piano: 0,
  capienza: 30,
  durataMinimaMinuti: 60,
  durataMassimaMinuti: 240,
  tipoAula: 'didattica',
  haProiettore: false,
  haLavagnaInterattiva: false,
  dipartimento: 'DEI',
  numeroPostazioni: 20,
  softwareInstallato: '',
  richiedeAbilitazione: false
};

// softwareInstallato: array sul server, testo separato da virgole nel modulo
function daRisorsaACampi(risorsa) {
  return {
    ...CAMPI_VUOTI,
    ...risorsa,
    softwareInstallato: (risorsa.softwareInstallato || []).join(', ')
  };
}

function daCampiARisorsa(campi) {
  const comuni = {
    tipoRisorsa: campi.tipoRisorsa,
    codice: campi.codice,
    nome: campi.nome,
    edificio: campi.edificio,
    piano: Number(campi.piano),
    capienza: Number(campi.capienza),
    durataMinimaMinuti: Number(campi.durataMinimaMinuti),
    durataMassimaMinuti: Number(campi.durataMassimaMinuti)
  };

  if (campi.tipoRisorsa === 'Aula') {
    return {
      ...comuni,
      tipoAula: campi.tipoAula,
      haProiettore: campi.haProiettore,
      haLavagnaInterattiva: campi.haLavagnaInterattiva
    };
  }

  return {
    ...comuni,
    dipartimento: campi.dipartimento,
    numeroPostazioni: Number(campi.numeroPostazioni),
    softwareInstallato: campi.softwareInstallato
      .split(',')
      .map((voce) => voce.trim())
      .filter((voce) => voce.length > 0),
    richiedeAbilitazione: campi.richiedeAbilitazione
  };
}

export default function GestioneRisorse() {
  const [elenco, impostaElenco] = useState([]);
  const [campi, impostaCampi] = useState(CAMPI_VUOTI);
  const [inModifica, impostaInModifica] = useState(null);
  const [errore, impostaErrore] = useState('');
  const [successo, impostaSuccesso] = useState('');

  const carica = useCallback(async () => {
    try {
      const risposta = await apiRisorse.elenca({ includiDisattivate: true });
      impostaElenco(risposta.risorse);
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }, []);

  useEffect(() => {
    carica();
  }, [carica]);

  function aggiorna(campo, valore) {
    impostaCampi((precedenti) => ({ ...precedenti, [campo]: valore }));
  }

  function annullaModifica() {
    impostaInModifica(null);
    impostaCampi(CAMPI_VUOTI);
  }

  async function invia(evento) {
    evento.preventDefault();
    impostaErrore('');
    impostaSuccesso('');

    try {
      if (inModifica) {
        await apiRisorse.aggiorna(inModifica, daCampiARisorsa(campi));
        impostaSuccesso('Risorsa aggiornata');
      } else {
        await apiRisorse.crea(daCampiARisorsa(campi));
        impostaSuccesso('Risorsa creata');
      }
      annullaModifica();
      await carica();
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }

  async function commuta(risorsa) {
    impostaErrore('');
    try {
      await apiRisorse.attivazione(risorsa._id, !risorsa.attiva);
      await carica();
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }

  async function elimina(risorsa) {
    impostaErrore('');
    impostaSuccesso('');
    try {
      await apiRisorse.elimina(risorsa._id);
      impostaSuccesso('Risorsa eliminata');
      await carica();
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }

  return (
    <div>
      <h2>Risorse</h2>

      <form className="riquadro" onSubmit={invia}>
        <h3>{inModifica ? 'Modifica risorsa' : 'Nuova risorsa'}</h3>

        <div className="riga">
          <label>
            Tipo
            <select
              value={campi.tipoRisorsa}
              onChange={(evento) => aggiorna('tipoRisorsa', evento.target.value)}
              disabled={Boolean(inModifica)}
            >
              <option value="Aula">Aula</option>
              <option value="Laboratorio">Laboratorio</option>
            </select>
          </label>

          <label>
            Codice
            <input
              value={campi.codice}
              onChange={(evento) => aggiorna('codice', evento.target.value)}
              required
            />
          </label>

          <label>
            Nome
            <input
              value={campi.nome}
              onChange={(evento) => aggiorna('nome', evento.target.value)}
              required
            />
          </label>
        </div>

        <div className="riga">
          <label>
            Edificio
            <input
              value={campi.edificio}
              onChange={(evento) => aggiorna('edificio', evento.target.value)}
              required
            />
          </label>

          <label>
            Piano
            <input
              type="number"
              value={campi.piano}
              onChange={(evento) => aggiorna('piano', evento.target.value)}
              required
            />
          </label>

          <label>
            Capienza
            <input
              type="number"
              min="1"
              value={campi.capienza}
              onChange={(evento) => aggiorna('capienza', evento.target.value)}
              required
            />
          </label>
        </div>

        <div className="riga">
          <label>
            Durata minima (minuti)
            <input
              type="number"
              min="1"
              value={campi.durataMinimaMinuti}
              onChange={(evento) => aggiorna('durataMinimaMinuti', evento.target.value)}
            />
          </label>

          <label>
            Durata massima (minuti)
            <input
              type="number"
              min="1"
              value={campi.durataMassimaMinuti}
              onChange={(evento) => aggiorna('durataMassimaMinuti', evento.target.value)}
            />
          </label>
        </div>

        {campi.tipoRisorsa === 'Aula' ? (
          <div className="riga">
            <label>
              Tipo di aula
              <select
                value={campi.tipoAula}
                onChange={(evento) => aggiorna('tipoAula', evento.target.value)}
              >
                <option value="didattica">Didattica</option>
                <option value="studio">Studio</option>
              </select>
            </label>

            <label className="casella">
              <input
                type="checkbox"
                checked={campi.haProiettore}
                onChange={(evento) => aggiorna('haProiettore', evento.target.checked)}
              />
              Proiettore
            </label>

            <label className="casella">
              <input
                type="checkbox"
                checked={campi.haLavagnaInterattiva}
                onChange={(evento) =>
                  aggiorna('haLavagnaInterattiva', evento.target.checked)
                }
              />
              Lavagna interattiva
            </label>
          </div>
        ) : (
          <div className="riga">
            <label>
              Dipartimento
              <select
                value={campi.dipartimento}
                onChange={(evento) => aggiorna('dipartimento', evento.target.value)}
              >
                {DIPARTIMENTI.map((dipartimento) => (
                  <option key={dipartimento} value={dipartimento}>
                    {dipartimento}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Postazioni
              <input
                type="number"
                min="1"
                value={campi.numeroPostazioni}
                onChange={(evento) => aggiorna('numeroPostazioni', evento.target.value)}
              />
            </label>

            <label>
              Software installato
              <input
                value={campi.softwareInstallato}
                onChange={(evento) => aggiorna('softwareInstallato', evento.target.value)}
                placeholder="MATLAB, ROS 2"
              />
            </label>

            <label className="casella">
              <input
                type="checkbox"
                checked={campi.richiedeAbilitazione}
                onChange={(evento) =>
                  aggiorna('richiedeAbilitazione', evento.target.checked)
                }
              />
              Richiede abilitazione
            </label>
          </div>
        )}

        <Avviso errore={errore} successo={successo} />

        <div className="riga">
          <button type="submit">{inModifica ? 'Salva' : 'Crea'}</button>
          {inModifica && (
            <button type="button" onClick={annullaModifica}>
              Annulla
            </button>
          )}
        </div>
      </form>

      <table className="tabella">
        <thead>
          <tr>
            <th>Codice</th>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Durate</th>
            <th>Stato</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {elenco.map((risorsa) => (
            <tr key={risorsa._id}>
              <td>{risorsa.codice}</td>
              <td>{risorsa.nome}</td>
              <td>
                {risorsa.tipoRisorsa === 'Aula'
                  ? `Aula ${risorsa.tipoAula}`
                  : `Laboratorio ${risorsa.dipartimento}`}
              </td>
              <td>
                {risorsa.durataMinimaMinuti} - {risorsa.durataMassimaMinuti} min
              </td>
              <td>{risorsa.attiva ? 'attiva' : 'disattivata'}</td>
              <td>
                <button
                  type="button"
                  onClick={() => {
                    impostaInModifica(risorsa._id);
                    impostaCampi(daRisorsaACampi(risorsa));
                  }}
                >
                  Modifica
                </button>
                <button type="button" onClick={() => commuta(risorsa)}>
                  {risorsa.attiva ? 'Disattiva' : 'Riattiva'}
                </button>
                <button type="button" onClick={() => elimina(risorsa)}>
                  Elimina
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
