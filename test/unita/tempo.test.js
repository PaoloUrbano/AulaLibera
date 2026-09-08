const tempo = require('../../src/servizi/tempo');

describe('Funzioni di calcolo sul tempo', () => {
  test('converte un orario HH:MM nel numero di minuti trascorsi da mezzanotte', () => {
    expect(tempo.orarioInMinuti('00:00')).toBe(0);
    expect(tempo.orarioInMinuti('08:30')).toBe(510);
    expect(tempo.orarioInMinuti('20:00')).toBe(1200);
  });

  test('calcola la durata in minuti fra due istanti', () => {
    const inizio = new Date(2026, 8, 15, 9, 0);
    const fine = new Date(2026, 8, 15, 10, 30);
    expect(tempo.durataInMinuti(inizio, fine)).toBe(90);
  });

  test('riconosce come allineato un istante multiplo della durata dello slot', () => {
    expect(tempo.eAllineatoAlloSlot(new Date(2026, 8, 15, 9, 30), 30)).toBe(true);
    expect(tempo.eAllineatoAlloSlot(new Date(2026, 8, 15, 9, 0), 60)).toBe(true);
  });

  test('riconosce come non allineato un istante che cade dentro uno slot', () => {
    expect(tempo.eAllineatoAlloSlot(new Date(2026, 8, 15, 9, 15), 30)).toBe(false);
    expect(tempo.eAllineatoAlloSlot(new Date(2026, 8, 15, 9, 30), 60)).toBe(false);
  });

  test('considera non allineato un istante con secondi residui', () => {
    expect(tempo.eAllineatoAlloSlot(new Date(2026, 8, 15, 9, 30, 45), 30)).toBe(false);
  });

  test('elenca gli slot coperti dall intervallo escludendo quello di fine', () => {
    const slot = tempo.elencaSlot(
      new Date(2026, 8, 15, 9, 0),
      new Date(2026, 8, 15, 10, 30),
      30
    );

    expect(slot).toHaveLength(3);
    expect(slot[0]).toEqual(new Date(2026, 8, 15, 9, 0));
    expect(slot[2]).toEqual(new Date(2026, 8, 15, 10, 0));
  });

  test('riconosce due istanti dello stesso giorno di calendario', () => {
    expect(
      tempo.stessoGiorno(
        new Date(2026, 8, 15, 8, 0),
        new Date(2026, 8, 15, 19, 59)
      )
    ).toBe(true);
    expect(
      tempo.stessoGiorno(new Date(2026, 8, 15, 23, 0), new Date(2026, 8, 16, 1, 0))
    ).toBe(false);
  });

  test('compone un istante locale da giorno e orario', () => {
    const istante = tempo.componiData('2026-09-15', '14:30');
    expect(istante.getFullYear()).toBe(2026);
    expect(istante.getMonth()).toBe(8);
    expect(istante.getDate()).toBe(15);
    expect(tempo.minutiDaMezzanotte(istante)).toBe(870);
  });
});
