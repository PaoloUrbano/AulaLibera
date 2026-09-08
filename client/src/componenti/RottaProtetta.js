import React from 'react';
import { Navigate } from 'react-router-dom';

import { usaAutenticazione } from '../contesti/ContestoAutenticazione';

// Impedisce di raggiungere una pagina senza essere autenticati o senza avere il ruolo
// richiesto. È una comodità di navigazione, non un controllo di sicurezza: la vera
// autorizzazione avviene nel middleware del backend, che respinge comunque le richieste
// non consentite anche se qualcuno raggiungesse la pagina in altro modo.
export default function RottaProtetta({ ruoli, children }) {
  const { utente, inCaricamento } = usaAutenticazione();

  if (inCaricamento) {
    return <p className="caricamento">Caricamento in corso...</p>;
  }

  if (!utente) {
    return <Navigate to="/accesso" replace />;
  }

  if (ruoli && !ruoli.includes(utente.ruolo)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
