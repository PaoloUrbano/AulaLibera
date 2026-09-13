// unico punto del client che conosce i percorsi del backend

const BASE = '/api';

let tokenCorrente = null;

export function impostaToken(token) {
  tokenCorrente = token;
}

async function richiedi(metodo, percorso, corpo) {
  const intestazioni = {};
  if (corpo !== undefined) {
    intestazioni['Content-Type'] = 'application/json';
  }
  if (tokenCorrente) {
    intestazioni.Authorization = `Bearer ${tokenCorrente}`;
  }

  const risposta = await fetch(BASE + percorso, {
    method: metodo,
    headers: intestazioni,
    body: corpo === undefined ? undefined : JSON.stringify(corpo)
  });

  if (risposta.status === 204) {
    return null;
  }

  const contenuto = await risposta.json().catch(() => ({}));

  if (!risposta.ok) {
    const errore = new Error(contenuto.errore || 'Errore imprevisto');
    errore.codice = risposta.status;
    throw errore;
  }

  return contenuto;
}

function conParametri(percorso, parametri) {
  const query = new URLSearchParams();
  Object.entries(parametri || {}).forEach(([chiave, valore]) => {
    if (valore !== undefined && valore !== null && valore !== '') {
      query.append(chiave, valore);
    }
  });
  const stringa = query.toString();
  return stringa ? `${percorso}?${stringa}` : percorso;
}

export const autenticazione = {
  registra: (dati) => richiedi('POST', '/autenticazione/registrazione', dati),
  accedi: (dati) => richiedi('POST', '/autenticazione/accesso', dati),
  esci: () => richiedi('POST', '/autenticazione/disconnessione'),
  profilo: () => richiedi('GET', '/autenticazione/profilo')
};

export const risorse = {
  elenca: (filtri) => richiedi('GET', conParametri('/risorse', filtri)),
  ottieni: (id) => richiedi('GET', `/risorse/${id}`),
  disponibilita: (id, giorno) =>
    richiedi('GET', conParametri(`/risorse/${id}/disponibilita`, { giorno })),
  crea: (dati) => richiedi('POST', '/risorse', dati),
  aggiorna: (id, dati) => richiedi('PUT', `/risorse/${id}`, dati),
  attivazione: (id, attiva) =>
    richiedi('PATCH', `/risorse/${id}/attivazione`, { attiva }),
  elimina: (id) => richiedi('DELETE', `/risorse/${id}`),
  elencaStudenti: () => richiedi('GET', '/risorse/abilitazioni/studenti'),
  abilitazione: (idStudente, idLaboratorio, abilitato) =>
    richiedi('PUT', `/risorse/abilitazioni/${idStudente}/${idLaboratorio}`, {
      abilitato
    })
};

export const prenotazioni = {
  crea: (dati) => richiedi('POST', '/prenotazioni', dati),
  mie: (filtri) => richiedi('GET', conParametri('/prenotazioni/mie', filtri)),
  tutte: (filtri) => richiedi('GET', conParametri('/prenotazioni', filtri)),
  annulla: (id) => richiedi('PATCH', `/prenotazioni/${id}/annullamento`),
  cambiaStato: (id, stato) => richiedi('PATCH', `/prenotazioni/${id}/stato`, { stato })
};

export const configurazione = {
  ottieni: () => richiedi('GET', '/configurazione'),
  aggiorna: (dati) => richiedi('PUT', '/configurazione', dati)
};
