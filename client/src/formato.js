// Funzioni di formattazione condivise fra i componenti. Esprimere le durate in ore e
// minuti anziché in soli minuti evita che l'utente debba fare il conto da sé: è la
// stessa informazione, in una forma che non richiede interpretazione.

export function formattaDurata(minuti) {
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;

  if (ore === 0) {
    return `${resto} minuti`;
  }
  if (resto === 0) {
    return ore === 1 ? '1 ora' : `${ore} ore`;
  }
  return ore === 1 ? `1 ora e ${resto} minuti` : `${ore} ore e ${resto} minuti`;
}

export function formattaOra(istante) {
  return new Date(istante).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Accorda "casella" al numero: il testo dei vincoli viene composto in più punti e
// deve leggersi come una frase, non come un'etichetta.
export function formattaCaselle(quante) {
  return quante === 1 ? '1 casella' : `${quante} caselle`;
}
