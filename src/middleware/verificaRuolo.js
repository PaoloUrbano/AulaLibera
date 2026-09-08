const { ErroreAutorizzazione, ErroreAutenticazione } = require('../servizi/errori');

// Fabbrica di middleware di autorizzazione: verificaRuolo('amministratore') restituisce
// il middleware che lascia passare i soli amministratori.
//
// Questo controllo è il punto in cui l'autorizzazione viene effettivamente applicata.
// Il frontend nasconde all'utente i comandi che non gli competono, ma nascondere un
// pulsante non è autorizzazione: una richiesta HTTP costruita a mano raggiunge comunque
// l'endpoint, ed è qui che viene respinta.
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
