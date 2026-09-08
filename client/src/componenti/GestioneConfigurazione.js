import React, { useEffect, useState } from 'react';

import Avviso from './Avviso';
import { configurazione as apiConfigurazione } from '../servizi/api';

// I parametri globali valgono per tutte le risorse. Cambiare la durata dello slot
// modifica la granularità con cui il sistema discretizza il tempo, quindi anche il modo
// in cui vengono acquisite le occupazioni delle prenotazioni successive.
export default function GestioneConfigurazione() {
  const [campi, impostaCampi] = useState(null);
  const [errore, impostaErrore] = useState('');
  const [successo, impostaSuccesso] = useState('');

  useEffect(() => {
    apiConfigurazione
      .ottieni()
      .then((risposta) => impostaCampi(risposta.configurazione))
      .catch((problema) => impostaErrore(problema.message));
  }, []);

  function aggiorna(campo, valore) {
    impostaCampi((precedenti) => ({ ...precedenti, [campo]: valore }));
  }

  async function invia(evento) {
    evento.preventDefault();
    impostaErrore('');
    impostaSuccesso('');

    try {
      const risposta = await apiConfigurazione.aggiorna({
        durataSlotMinuti: Number(campi.durataSlotMinuti),
        anticipoMassimoGiorni: Number(campi.anticipoMassimoGiorni),
        orarioApertura: campi.orarioApertura,
        orarioChiusura: campi.orarioChiusura,
        dominioEmailConsentito: campi.dominioEmailConsentito
      });
      impostaCampi(risposta.configurazione);
      impostaSuccesso('Configurazione aggiornata');
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }

  if (!campi) {
    return <p className="caricamento">Caricamento in corso...</p>;
  }

  return (
    <div>
      <h2>Configurazione di sistema</h2>

      <form className="riquadro" onSubmit={invia}>
        <div className="riga">
          <label>
            Durata dello slot (minuti)
            <input
              type="number"
              min="1"
              value={campi.durataSlotMinuti}
              onChange={(evento) => aggiorna('durataSlotMinuti', evento.target.value)}
            />
          </label>

          <label>
            Anticipo massimo (giorni)
            <input
              type="number"
              min="1"
              value={campi.anticipoMassimoGiorni}
              onChange={(evento) =>
                aggiorna('anticipoMassimoGiorni', evento.target.value)
              }
            />
          </label>
        </div>

        <div className="riga">
          <label>
            Orario di apertura
            <input
              type="time"
              value={campi.orarioApertura}
              onChange={(evento) => aggiorna('orarioApertura', evento.target.value)}
            />
          </label>

          <label>
            Orario di chiusura
            <input
              type="time"
              value={campi.orarioChiusura}
              onChange={(evento) => aggiorna('orarioChiusura', evento.target.value)}
            />
          </label>

          <label>
            Dominio email consentito
            <input
              value={campi.dominioEmailConsentito}
              onChange={(evento) =>
                aggiorna('dominioEmailConsentito', evento.target.value)
              }
            />
          </label>
        </div>

        <Avviso errore={errore} successo={successo} />

        <button type="submit">Salva la configurazione</button>
      </form>
    </div>
  );
}
