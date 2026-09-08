import React from 'react';

// Mostra all'utente l'esito di un'operazione. I messaggi di errore sono quelli
// prodotti dal dominio sul server: il client non li reinterpreta.
export default function Avviso({ errore, successo }) {
  if (!errore && !successo) {
    return null;
  }

  return (
    <p className={errore ? 'avviso avviso-errore' : 'avviso avviso-successo'}>
      {errore || successo}
    </p>
  );
}
