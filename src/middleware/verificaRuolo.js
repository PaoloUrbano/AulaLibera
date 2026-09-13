const { ErroreAutorizzazione, ErroreAutenticazione } = require('../servizi/errori');

// Qui avviene l'autorizzazione vera. Il frontend nasconde i comandi che non
// competono al ruolo, ma nascondere un pulsante non è autorizzazione: una
// richiesta costruita a mano arriva comunque all'endpoint ed è qui che viene respinta.
function verificaRuolo(...ruoliAmmessi) {
  return (richiesta, risposta, successivo) => {
    if (!richiesta.utente) {
      return successivo(new ErroreAutenticazione('Autenticazione richiesta'));
    }

    if (!ruoliAmmessi.includes(richiesta.utente.ruolo)) {
      return successivo(
        new ErroreAutorizzazione(
          'Il tuo ruolo non consente di eseguire questa operazione'
        )
      );
    }

    return successivo();
  };
}

module.exports = verificaRuolo;
