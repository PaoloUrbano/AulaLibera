import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Avviso from '../componenti/Avviso';
import { autenticazione } from '../servizi/api';

export default function PaginaRegistrazione() {
  const vaiA = useNavigate();

  const [campi, impostaCampi] = useState({
    nome: '',
    cognome: '',
    email: '',
    password: '',
    ruolo: 'studente'
  });
  const [errore, impostaErrore] = useState('');
  const [successo, impostaSuccesso] = useState('');

  function aggiorna(campo, valore) {
    impostaCampi((precedenti) => ({ ...precedenti, [campo]: valore }));
  }

  async function invia(evento) {
    evento.preventDefault();
    impostaErrore('');
    try {
      await autenticazione.registra(campi);
      impostaSuccesso('Registrazione completata: ora puoi accedere');
      setTimeout(() => vaiA('/accesso'), 1200);
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }

  return (
    <section className="riquadro stretto">
      <h1>Registrazione</h1>

      <form onSubmit={invia}>
        <label>
          Nome
          <input
            value={campi.nome}
            onChange={(evento) => aggiorna('nome', evento.target.value)}
            required
          />
        </label>

        <label>
          Cognome
          <input
            value={campi.cognome}
            onChange={(evento) => aggiorna('cognome', evento.target.value)}
            required
          />
        </label>

        <label>
          Email istituzionale
          <input
            type="email"
            value={campi.email}
            onChange={(evento) => aggiorna('email', evento.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={campi.password}
            onChange={(evento) => aggiorna('password', evento.target.value)}
            required
          />
        </label>

        <label>
          Ruolo
          <select
            value={campi.ruolo}
            onChange={(evento) => aggiorna('ruolo', evento.target.value)}
          >
            <option value="studente">Studente</option>
            <option value="docente">Docente</option>
          </select>
        </label>

        <Avviso errore={errore} successo={successo} />

        <button type="submit">Registrati</button>
      </form>

      <p>
        Hai già un profilo? <Link to="/accesso">Accedi</Link>
      </p>
    </section>
  );
}
