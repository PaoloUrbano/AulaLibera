import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { usaAutenticazione } from '../contesti/ContestoAutenticazione';

export default function BarraNavigazione() {
  const { utente, esci, eAmministratore, puoPrenotare } = usaAutenticazione();
  const vaiA = useNavigate();

  async function disconnetti() {
    await esci();
    vaiA('/accesso');
  }

  return (
    <header className="barra">
      <Link to="/" className="marchio">
        AulaLibera
      </Link>

      {utente && (
        <nav className="collegamenti">
          {puoPrenotare && <NavLink to="/">Prenota</NavLink>}
          {puoPrenotare && <NavLink to="/prenotazioni">Le mie prenotazioni</NavLink>}

          {/* L'accesso all'area di gestione compare al solo amministratore. Nasconderlo
              agli altri è una scelta di usabilità: l'autorizzazione resta quella
              applicata dal backend su ogni singolo endpoint. */}
          {eAmministratore && (
            <NavLink to="/amministrazione" title="Area di gestione">
              Gestione
            </NavLink>
          )}
        </nav>
      )}

      {utente && (
        <div className="identita">
          <span>
            {utente.nome} {utente.cognome} ({utente.ruolo})
          </span>
          <button type="button" onClick={disconnetti}>
            Esci
          </button>
        </div>
      )}
    </header>
  );
}
