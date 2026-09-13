import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { autenticazione, impostaToken } from '../servizi/api';

const CHIAVE_TOKEN = 'aulalibera.token';

const ContestoAutenticazione = createContext(null);

// Il token sta in localStorage per sopravvivere al ricaricamento; l'utente
// invece si richiede al server, così ruolo e abilitazioni sono quelli attuali.
export function FornitoreAutenticazione({ children }) {
  const [utente, impostaUtente] = useState(null);
  const [inCaricamento, impostaInCaricamento] = useState(true);

  useEffect(() => {
    const tokenSalvato = localStorage.getItem(CHIAVE_TOKEN);

    if (!tokenSalvato) {
      impostaInCaricamento(false);
      return;
    }

    impostaToken(tokenSalvato);
    autenticazione
      .profilo()
      .then((risposta) => impostaUtente(risposta.utente))
      .catch(() => {
        localStorage.removeItem(CHIAVE_TOKEN);
        impostaToken(null);
      })
      .finally(() => impostaInCaricamento(false));
  }, []);

  const accedi = useCallback(async (email, password) => {
    const risposta = await autenticazione.accedi({ email, password });
    localStorage.setItem(CHIAVE_TOKEN, risposta.token);
    impostaToken(risposta.token);
    impostaUtente(risposta.utente);
    return risposta.utente;
  }, []);

  const esci = useCallback(async () => {
    await autenticazione.esci().catch(() => undefined);
    localStorage.removeItem(CHIAVE_TOKEN);
    impostaToken(null);
    impostaUtente(null);
  }, []);

  const valore = {
    utente,
    inCaricamento,
    accedi,
    esci,
    eAmministratore: utente ? utente.ruolo === 'amministratore' : false,
    puoPrenotare: utente ? utente.ruolo !== 'amministratore' : false
  };

  return (
    <ContestoAutenticazione.Provider value={valore}>
      {children}
    </ContestoAutenticazione.Provider>
  );
}

export function usaAutenticazione() {
  const contesto = useContext(ContestoAutenticazione);
  if (!contesto) {
    throw new Error(
      'usaAutenticazione va invocato dentro il FornitoreAutenticazione'
    );
  }
  return contesto;
}
