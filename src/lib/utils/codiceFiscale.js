// Utility per il calcolo del codice fiscale italiano

const MESI = {
  1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'H',
  7: 'L', 8: 'M', 9: 'P', 10: 'R', 11: 'S', 12: 'T'
};

const CARATTERI_DISPARI = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
  'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
  'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
};

const CARATTERI_PARI = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
  'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18,
  'T': 19, 'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
};

const CARATTERI_RESTO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Estrae le consonanti da una stringa
 */
function estraiConsonanti(str) {
  return str.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');
}

/**
 * Estrae le vocali da una stringa
 */
function estraiVocali(str) {
  return str.toUpperCase().replace(/[^AEIOU]/g, '');
}

/**
 * Calcola il codice del cognome
 */
function calcolaCognome(cognome) {
  const consonanti = estraiConsonanti(cognome);
  const vocali = estraiVocali(cognome);
  let codice = consonanti + vocali + 'XXX';
  return codice.substring(0, 3);
}

/**
 * Calcola il codice del nome
 */
function calcolaNome(nome) {
  const consonanti = estraiConsonanti(nome);
  const vocali = estraiVocali(nome);

  let codice;
  if (consonanti.length >= 4) {
    // Se ci sono 4 o più consonanti, prendi la 1a, 3a e 4a
    codice = consonanti[0] + consonanti[2] + consonanti[3];
  } else {
    codice = consonanti + vocali + 'XXX';
  }

  return codice.substring(0, 3);
}

/**
 * Calcola il codice della data di nascita e sesso
 */
function calcolaDataSesso(dataNascita, sesso) {
  const data = new Date(dataNascita);
  const anno = data.getFullYear().toString().substring(2);
  const mese = MESI[data.getMonth() + 1];
  let giorno = data.getDate();

  // Per le donne si aggiunge 40 al giorno
  if (sesso === 'F') {
    giorno += 40;
  }

  const giornoStr = giorno.toString().padStart(2, '0');

  return anno + mese + giornoStr;
}

/**
 * Calcola il carattere di controllo
 */
function calcolaCarattereControllo(codice15) {
  let somma = 0;

  for (let i = 0; i < 15; i++) {
    const char = codice15[i];
    if (i % 2 === 0) {
      // Posizione dispari (0-indexed, quindi pari è dispari in 1-indexed)
      somma += CARATTERI_DISPARI[char];
    } else {
      // Posizione pari
      somma += CARATTERI_PARI[char];
    }
  }

  const resto = somma % 26;
  return CARATTERI_RESTO[resto];
}

/**
 * Calcola il codice fiscale completo
 * @param {Object} dati - Oggetto con i dati anagrafici
 * @param {string} dati.nome - Nome
 * @param {string} dati.cognome - Cognome
 * @param {string} dati.dataNascita - Data di nascita (formato YYYY-MM-DD)
 * @param {string} dati.sesso - Sesso (M o F)
 * @param {string} dati.codiceComuneNascita - Codice catastale del comune o stato di nascita
 * @returns {string|null} - Codice fiscale calcolato o null se dati insufficienti
 */
export function calcolaCodiceFiscale(dati) {
  const { nome, cognome, dataNascita, sesso, codiceComuneNascita } = dati;

  // Verifica che tutti i dati necessari siano presenti
  if (!nome || !cognome || !dataNascita || !sesso || !codiceComuneNascita) {
    return null;
  }

  try {
    const codiceCognome = calcolaCognome(cognome);
    const codiceNome = calcolaNome(nome);
    const codiceDataSesso = calcolaDataSesso(dataNascita, sesso);
    const codiceComune = codiceComuneNascita.toUpperCase();

    const codice15 = codiceCognome + codiceNome + codiceDataSesso + codiceComune;
    const carattereControllo = calcolaCarattereControllo(codice15);

    return codice15 + carattereControllo;
  } catch (error) {
    console.error('Errore nel calcolo del codice fiscale:', error);
    return null;
  }
}

/**
 * Valida un codice fiscale
 * @param {string} cf - Codice fiscale da validare
 * @returns {boolean} - True se il codice fiscale è valido
 */
export function validaCodiceFiscale(cf) {
  if (!cf || cf.length !== 16) {
    return false;
  }

  const cfUpper = cf.toUpperCase();
  const codice15 = cfUpper.substring(0, 15);
  const carattereControlloAtteso = calcolaCarattereControllo(codice15);

  return cfUpper[15] === carattereControlloAtteso;
}
