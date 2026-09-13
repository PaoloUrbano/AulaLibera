import React from 'react';
import { Navigate } from 'react-router-dom';

import { usaAutenticazione } from '../contesti/ContestoAutenticazione';

// Comodità di navigazione, non sicurezza: l'autorizzazione vera è nel
// middleware del backend, che respinge comunque le richieste non consentite.
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
