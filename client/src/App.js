import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import BarraNavigazione from './componenti/BarraNavigazione';
import RottaProtetta from './componenti/RottaProtetta';
import {
  FornitoreAutenticazione,
  usaAutenticazione
} from './contesti/ContestoAutenticazione';
import PaginaAccesso from './pagine/PaginaAccesso';
import PaginaRegistrazione from './pagine/PaginaRegistrazione';
import PaginaPrenotazione from './pagine/PaginaPrenotazione';
import PaginaMiePrenotazioni from './pagine/PaginaMiePrenotazioni';
import PaginaAmministrazione from './pagine/PaginaAmministrazione';

// Una sola applicazione per tutti i ruoli: la pagina iniziale è quella di prenotazione,
// tranne che per l'amministratore, che non prenota e viene condotto alla gestione.
function PaginaIniziale() {
  const { eAmministratore } = usaAutenticazione();
  return eAmministratore ? (
    <Navigate to="/amministrazione" replace />
  ) : (
    <PaginaPrenotazione />
  );
}

export default function App() {
  return (
    <FornitoreAutenticazione>
      <BarraNavigazione />

      <main className="contenuto">
        <Routes>
          <Route path="/accesso" element={<PaginaAccesso />} />
          <Route path="/registrazione" element={<PaginaRegistrazione />} />

          <Route
            path="/"
            element={
              <RottaProtetta>
                <PaginaIniziale />
              </RottaProtetta>
            }
          />

          <Route
            path="/prenotazioni"
            element={
              <RottaProtetta ruoli={['studente', 'docente']}>
                <PaginaMiePrenotazioni />
              </RottaProtetta>
            }
          />

          <Route
            path="/amministrazione"
            element={
              <RottaProtetta ruoli={['amministratore']}>
                <PaginaAmministrazione />
              </RottaProtetta>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </FornitoreAutenticazione>
  );
}
