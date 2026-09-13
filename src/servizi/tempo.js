// Funzioni pure sul tempo, condivise dai servizi.
// Tutto ragiona in ora locale del processo: apertura e chiusura sono orari di Bari,
// quindi il server deve girare con TZ=Europe/Rome (vedi Dockerfile e server.js).

const MINUTI_IN_UN_GIORNO = 24 * 60;
const MILLISECONDI_IN_UN_MINUTO = 60 * 1000;

function minutiDaMezzanotte(data) {
  return data.getHours() * 60 + data.getMinutes();
}

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

function eAllineatoAlloSlot(data, durataSlotMinuti) {
  if (data.getSeconds() !== 0 || data.getMilliseconds() !== 0) {
    return false;
  }
  return minutiDaMezzanotte(data) % durataSlotMinuti === 0;
}

// intervallo [inizio, fine): 09:00-10:00 con slot da 30' occupa 09:00 e 09:30
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

// "AAAA-MM-GG" + "HH:MM" -> Date locale
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
