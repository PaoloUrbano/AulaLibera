import React from 'react';

import { formattaDurata } from '../formato';

// l'elenco arriva già filtrato per ruolo dal backend
export default function ElencoRisorse({ risorse, selezionata, onSeleziona }) {
  if (risorse.length === 0) {
    return <p className="vuoto">Nessuna risorsa corrisponde ai criteri indicati.</p>;
  }

  return (
    <ul className="elenco-risorse">
      {risorse.map((risorsa) => (
        <li
          key={risorsa._id}
          className={
            selezionata && selezionata._id === risorsa._id
              ? 'risorsa selezionata'
              : 'risorsa'
          }
        >
          <button type="button" onClick={() => onSeleziona(risorsa)}>
            <strong>{risorsa.nome}</strong>
            <span className="codice">{risorsa.codice}</span>

            <span className="dettagli">
              {risorsa.tipoRisorsa === 'Aula'
                ? `Aula ${risorsa.tipoAula}`
                : `Laboratorio ${risorsa.dipartimento}`}
              {' · '}
              {risorsa.edificio}, piano {risorsa.piano}
              {' · '}
              {risorsa.capienza} posti
            </span>

            <span className="dettagli">
              Prenotabile da {formattaDurata(risorsa.durataMinimaMinuti)} a{' '}
              {formattaDurata(risorsa.durataMassimaMinuti)}
            </span>

            {risorsa.tipoRisorsa === 'Laboratorio' &&
              risorsa.softwareInstallato &&
              risorsa.softwareInstallato.length > 0 && (
                <span className="dettagli">
                  Software: {risorsa.softwareInstallato.join(', ')}
                </span>
              )}
          </button>
        </li>
      ))}
    </ul>
  );
}
