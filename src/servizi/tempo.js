// Funzioni pure sul tempo, usate dalle regole di dominio che riguardano gli orari.
// Sono isolate qui perché servono a più servizi e perché, non dipendendo da modelli
// né da Express, sono verificabili con test di unità diretti.
//
// Tutti i calcoli usano il fuso orario locale del server: gli orari di apertura e
// chiusura dell'ateneo sono orari locali, non istanti UTC.

const MINUTI_IN_UN_GIORNO = 24 * 60;
const MILLISECONDI_IN_UN_MINUTO = 60 * 1000;

function minutiDaMezzanotte(data) {
  return data.getHours() * 60 + data.getMinutes();
}

// Converte un orario nella forma "HH:MM" nel numero di minuti trascorsi da mezzanotte.
function orarioInMinuti(orario) {
  const [ore, minuti] = orario.split(':').map(Number);
  return ore * 60 + minuti;
}

function durataInMinuti(dataOraInizio, dataOraFine) {
  return (dataOraFine.getTime() - dataOraInizio.getTime()) / MILLISECONDI_IN_UN_MINUTO;
}

function stessoGiorno(primaData, secondaData) {
  return (
    primaData.getFullYear() === secondaData.getFullYear() &&
    primaData.getMonth() === secondaData.getMonth() &&
    primaData.getDate() === secondaData.getDate()
  );
}

// Un istante è allineato allo slot se dista da mezzanotte un multiplo esatto della
// durata dello slot e non porta secondi o millisecondi residui.
function eAllineatoAlloSlot(data, durataSlotMinuti) {
  if (data.getSeconds() !== 0 || data.getMilliseconds() !== 0) {
    return false;
  }
  return minutiDaMezzanotte(data) % durataSlotMinuti === 0;
}

// Elenca gli istanti di inizio degli slot coperti dall'intervallo [inizio, fine).
// La fine è esclusa: una prenotazione 09:00-10:00 con slot da 30 minuti occupa gli
// slot 09:00 e 09:30, non quello delle 10:00.
function elencaSlot(dataOraInizio, dataOraFine, durataSlotMinuti) {
  const passo = durataSlotMinuti * MILLISECONDI_IN_UN_MINUTO;
  const slot = [];
  for (
    let istante = dataOraInizio.getTime();
    istante < dataOraFine.getTime();
    istante += passo
  ) {
    slot.push(new Date(istante));
  }
  return slot;
}

// Compone un istante a partire da un giorno "AAAA-MM-GG" e un orario "HH:MM",
// interpretati nel fuso orario locale.
function componiData(giorno, orario) {
  const [anno, mese, numeroGiorno] = giorno.split('-').map(Number);
  const [ore, minuti] = orario.split(':').map(Number);
  return new Date(anno, mese - 1, numeroGiorno, ore, minuti, 0, 0);
}

module.exports = {
  MINUTI_IN_UN_GIORNO,
  MILLISECONDI_IN_UN_MINUTO,
  minutiDaMezzanotte,
  orarioInMinuti,
  durataInMinuti,
  stessoGiorno,
  eAllineatoAlloSlot,
  elencaSlot,
  componiData
};
