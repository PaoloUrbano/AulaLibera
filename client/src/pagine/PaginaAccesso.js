import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Avviso from '../componenti/Avviso';
import { usaAutenticazione } from '../contesti/ContestoAutenticazione';

export default function PaginaAccesso() {
  const { accedi } = usaAutenticazione();
  const vaiA = useNavigate();

  const [email, impostaEmail] = useState('');
  const [password, impostaPassword] = useState('');
  const [errore, impostaErrore] = useState('');

  async function invia(evento) {
    evento.preventDefault();
    impostaErrore('');
    try {
      await accedi(email, password);
      vaiA('/');
    } catch (problema) {
      impostaErrore(problema.message);
    }
  }

  return (
    <section className="riquadro stretto">
      <h1>Accesso</h1>

      <form onSubmit={invia}>
        <label>
          Email istituzionale
          <input
            type="email"
            value={email}
            onChange={(evento) => impostaEmail(evento.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(evento) => impostaPassword(evento.target.value)}
            required
          />
        </label>

        <Avviso errore={errore} />

        <button type="submit">Accedi</button>
      </form>

      <p>
        Non hai un profilo? <Link to="/registrazione">Registrati</Link>
      </p>
    </section>
  );
}
