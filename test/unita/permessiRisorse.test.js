const mongoose = require('mongoose');

const Utente = require('../../src/modelli/Utente');
const { Aula, Laboratorio } = require('../../src/modelli/RisorsaPrenotabile');
const servizioRisorse = require('../../src/servizi/servizioRisorse');
const { ErroreAutorizzazione } = require('../../src/servizi/errori');

function creaUtente(ruolo, abilitazioniLaboratori = []) {
  return new Utente({
    nome: 'Nome',
    cognome: 'Cognome',
    email: `${ruolo}@poliba.it`,
    passwordHash: 'irrilevante',
    ruolo,
    abilitazioniLaboratori
  });
}

function creaAula(tipoAula, attiva = true) {
  return new Aula({
    codice: 'A1',
    nome: 'Aula di prova',
    edificio: 'Q',
    piano: 0,
    capienza: 50,
    tipoAula,
    attiva
  });
}

function creaLaboratorio(richiedeAbilitazione) {
  return new Laboratorio({
    codice: 'L1',
    nome: 'Laboratorio di prova',
    edificio: 'Q',
    piano: 1,
    capienza: 20,
    dipartimento: 'DEI',
    numeroPostazioni: 20,
    richiedeAbilitazione
  });
}

describe('Regole di prenotabilità per ruolo', () => {
  test("l'amministratore non può prenotare alcuna risorsa", () => {
    const amministratore = creaUtente('amministratore');
    expect(servizioRisorse.puoPrenotare(amministratore, creaAula('studio'))).toBe(
      false
    );
    expect(
      servizioRisorse.puoPrenotare(amministratore, creaLaboratorio(false))
    ).toBe(false);
  });

  test('nessun ruolo può prenotare una risorsa disattivata', () => {
    const docente = creaUtente('docente');
    expect(
      servizioRisorse.puoPrenotare(docente, creaAula('didattica', false))
    ).toBe(false);
  });

  test('lo studente può prenotare le aule studio ma non quelle didattiche', () => {
    const studente = creaUtente('studente');
    expect(servizioRisorse.puoPrenotare(studente, creaAula('studio'))).toBe(true);
    expect(servizioRisorse.puoPrenotare(studente, creaAula('didattica'))).toBe(
      false
    );
  });

  test('il docente può prenotare le aule didattiche e quelle studio', () => {
    const docente = creaUtente('docente');
    expect(servizioRisorse.puoPrenotare(docente, creaAula('didattica'))).toBe(true);
    expect(servizioRisorse.puoPrenotare(docente, creaAula('studio'))).toBe(true);
  });

  test('lo studente può prenotare un laboratorio che non richiede abilitazione', () => {
    const studente = creaUtente('studente');
    expect(servizioRisorse.puoPrenotare(studente, creaLaboratorio(false))).toBe(
      true
    );
  });

  test('lo studente non abilitato non può prenotare un laboratorio che la richiede', () => {
    const studente = creaUtente('studente');
    const laboratorio = creaLaboratorio(true);
    expect(servizioRisorse.puoPrenotare(studente, laboratorio)).toBe(false);
  });

  test('lo studente abilitato può prenotare il laboratorio che richiede abilitazione', () => {
    const laboratorio = creaLaboratorio(true);
    const studente = creaUtente('studente', [laboratorio._id]);
    expect(servizioRisorse.puoPrenotare(studente, laboratorio)).toBe(true);
  });

  test("l'abilitazione vale solo per il laboratorio a cui si riferisce", () => {
    const laboratorioAbilitato = creaLaboratorio(true);
    const altroLaboratorio = creaLaboratorio(true);
    altroLaboratorio._id = new mongoose.Types.ObjectId();

    const studente = creaUtente('studente', [laboratorioAbilitato._id]);

    expect(servizioRisorse.puoPrenotare(studente, laboratorioAbilitato)).toBe(true);
    expect(servizioRisorse.puoPrenotare(studente, altroLaboratorio)).toBe(false);
  });

  test('il docente prenota i laboratori senza vincolo di abilitazione', () => {
    const docente = creaUtente('docente');
    expect(servizioRisorse.puoPrenotare(docente, creaLaboratorio(true))).toBe(true);
  });

  test('verificaPrenotabilita solleva un errore di autorizzazione con il motivo', () => {
    const studente = creaUtente('studente');
    expect(() =>
      servizioRisorse.verificaPrenotabilita(studente, creaAula('didattica'))
    ).toThrow(ErroreAutorizzazione);
  });
});
