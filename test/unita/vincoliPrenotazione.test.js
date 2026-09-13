const { verificaVincoliTemporali } = require('../../src/servizi/servizioPrenotazioni');
const { ErroreValidazione } = require('../../src/servizi/errori');

const configurazione = {
  durataSlotMinuti: 30,
  anticipoMassimoGiorni: 30,
  orarioApertura: '08:00',
  orarioChiusura: '20:00'
};

const risorsa = {
  durataMinimaMinuti: 60,
  durataMassimaMinuti: 240
};

function fraGiorni(giorni, ore, minuti = 0) {
  const istante = new Date();
  istante.setDate(istante.getDate() + giorni);
  istante.setHours(ore, minuti, 0, 0);
  return istante;
}

function verifica(inizio, fine, risorsaUsata = risorsa) {
  return () =>
    verificaVincoliTemporali(inizio, fine, risorsaUsata, configurazione);
}

describe('Vincoli di dominio su una richiesta di prenotazione', () => {
  test('accetta una richiesta conforme a tutti i vincoli', () => {
    expect(verifica(fraGiorni(1, 9), fraGiorni(1, 11))).not.toThrow();
  });

  test('rifiuta un intervallo con fine non successiva all inizio', () => {
    expect(verifica(fraGiorni(1, 10), fraGiorni(1, 10))).toThrow(ErroreValidazione);
  });

  test('rifiuta una prenotazione a cavallo di due giorni', () => {
    expect(verifica(fraGiorni(1, 23), fraGiorni(2, 1))).toThrow(
      /stesso giorno/
    );
  });

  test('rifiuta istanti non allineati alla durata dello slot', () => {
    expect(verifica(fraGiorni(1, 9, 15), fraGiorni(1, 11))).toThrow(/allineat/);
  });

  test('rifiuta una durata inferiore alla durata minima della risorsa', () => {
    expect(verifica(fraGiorni(1, 9), fraGiorni(1, 9, 30))).toThrow(/durata minima/);
  });

  test('rifiuta una durata superiore alla durata massima della risorsa', () => {
    expect(verifica(fraGiorni(1, 9), fraGiorni(1, 15))).toThrow(/durata massima/);
  });

  test('applica le durate della singola risorsa e non un valore di sistema', () => {
    const laboratorioBreve = { durataMinimaMinuti: 30, durataMassimaMinuti: 60 };
    expect(
      verifica(fraGiorni(1, 9), fraGiorni(1, 9, 30), laboratorioBreve)
    ).not.toThrow();
    expect(
      verifica(fraGiorni(1, 9), fraGiorni(1, 11), laboratorioBreve)
    ).toThrow(/durata massima/);
  });

  test('rifiuta un inizio precedente all orario di apertura', () => {
    expect(verifica(fraGiorni(1, 7), fraGiorni(1, 9))).toThrow(/08:00/);
  });

  test('rifiuta una fine successiva all orario di chiusura', () => {
    expect(verifica(fraGiorni(1, 19), fraGiorni(1, 21))).toThrow(/20:00/);
  });

  test('rifiuta una prenotazione collocata nel passato', () => {
    expect(verifica(fraGiorni(-1, 9), fraGiorni(-1, 11))).toThrow(/trascorso/);
  });

  test('rifiuta una prenotazione oltre l anticipo massimo consentito', () => {
    expect(verifica(fraGiorni(31, 9), fraGiorni(31, 11))).toThrow(/anticipo/);
  });

  test('accetta una prenotazione all ultimo giorno utile di anticipo', () => {
    expect(verifica(fraGiorni(29, 9), fraGiorni(29, 11))).not.toThrow();
  });
});
