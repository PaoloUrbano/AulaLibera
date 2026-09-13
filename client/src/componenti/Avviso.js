import React from 'react';

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
