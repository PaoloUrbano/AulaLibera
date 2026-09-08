import React, { useState } from 'react';

import GestioneRisorse from '../componenti/GestioneRisorse';
import GestioneConfigurazione from '../componenti/GestioneConfigurazione';
import GestioneAbilitazioni from '../componenti/GestioneAbilitazioni';
import GestionePrenotazioni from '../componenti/GestionePrenotazioni';

const SEZIONI = [
  { chiave: 'risorse', etichetta: 'Risorse', componente: GestioneRisorse },
  {
    chiave: 'configurazione',
    etichetta: 'Configurazione',
    componente: GestioneConfigurazione
  },
  {
    chiave: 'abilitazioni',
    etichetta: 'Abilitazioni',
    componente: GestioneAbilitazioni
  },
  {
    chiave: 'prenotazioni',
    etichetta: 'Prenotazioni',
    componente: GestionePrenotazioni
  }
];

// Area riservata all'amministratore, raggiungibile solo dal collegamento che compare
// al suo ruolo. Raccoglie le quattro funzioni di gestione previste dai casi d'uso.
export default function PaginaAmministrazione() {
  const [sezioneAttiva, impostaSezioneAttiva] = useState('risorse');

  const sezione = SEZIONI.find((voce) => voce.chiave === sezioneAttiva);
  const Componente = sezione.componente;

  return (
    <section>
      <h1>Area di gestione</h1>

      <nav className="schede">
        {SEZIONI.map((voce) => (
          <button
            key={voce.chiave}
            type="button"
            className={voce.chiave === sezioneAttiva ? 'scheda attiva' : 'scheda'}
            onClick={() => impostaSezioneAttiva(voce.chiave)}
          >
            {voce.etichetta}
          </button>
        ))}
      </nav>

      <Componente />
    </section>
  );
}
