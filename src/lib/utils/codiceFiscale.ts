// Utility per il calcolo del codice fiscale italiano

type SessoCodiceFiscale = 'M' | 'F' | 'Altro' | string;

export interface CodiceFiscaleInput {
  nome: string;
  cognome: string;
  dataNascita: string;
  sesso: SessoCodiceFiscale;
  codiceComuneNascita: string;
}

const MESI: Record<number, string> = {
  1: 'A',
  2: 'B',
  3: 'C',
  4: 'D',
  5: 'E',
  6: 'H',
  7: 'L',
  8: 'M',
  9: 'P',
  10: 'R',
  11: 'S',
  12: 'T'
};

const CARATTERI_DISPARI: Record<string, number> = {
  '0': 1,
  '1': 0,
  '2': 5,
  '3': 7,
  '4': 9,
  '5': 13,
  '6': 15,
  '7': 17,
  '8': 19,
  '9': 21,
  A: 1,
  B: 0,
  C: 5,
  D: 7,
  E: 9,
  F: 13,
  G: 15,
  H: 17,
  I: 19,
  J: 21,
  K: 2,
  L: 4,
  M: 18,
  N: 20,
  O: 11,
  P: 3,
  Q: 6,
  R: 8,
  S: 12,
  T: 14,
  U: 16,
  V: 10,
  W: 22,
  X: 25,
  Y: 24,
  Z: 23
};

const CARATTERI_PARI: Record<string, number> = {
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
  H: 7,
  I: 8,
  J: 9,
  K: 10,
  L: 11,
  M: 12,
  N: 13,
  O: 14,
  P: 15,
  Q: 16,
  R: 17,
  S: 18,
  T: 19,
  U: 20,
  V: 21,
  W: 22,
  X: 23,
  Y: 24,
  Z: 25
};

const CARATTERI_RESTO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function estraiConsonanti(str: string): string {
  return str.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');
}

function estraiVocali(str: string): string {
  return str.toUpperCase().replace(/[^AEIOU]/g, '');
}

function calcolaCognome(cognome: string): string {
  const consonanti = estraiConsonanti(cognome);
  const vocali = estraiVocali(cognome);
  return (consonanti + vocali + 'XXX').substring(0, 3);
}

function calcolaNome(nome: string): string {
  const consonanti = estraiConsonanti(nome);
  const vocali = estraiVocali(nome);

  if (consonanti.length >= 4) {
    return (consonanti[0] + consonanti[2] + consonanti[3]).substring(0, 3);
  }

  return (consonanti + vocali + 'XXX').substring(0, 3);
}

function calcolaDataSesso(dataNascita: string, sesso: SessoCodiceFiscale): string {
  const data = new Date(dataNascita);
  const anno = data.getFullYear().toString().substring(2);
  const mese = MESI[data.getMonth() + 1] ?? '';
  let giorno = data.getDate();

  if (sesso === 'F') {
    giorno += 40;
  }

  return anno + mese + giorno.toString().padStart(2, '0');
}

function calcolaCarattereControllo(codice15: string): string {
  let somma = 0;

  for (let i = 0; i < 15; i++) {
    const char = codice15[i]?.toUpperCase() ?? '';
    somma += i % 2 === 0 ? CARATTERI_DISPARI[char] ?? 0 : CARATTERI_PARI[char] ?? 0;
  }

  return CARATTERI_RESTO[somma % 26] ?? '';
}

export function calcolaCodiceFiscale(dati: CodiceFiscaleInput): string | null {
  const { nome, cognome, dataNascita, sesso, codiceComuneNascita } = dati;

  if (!nome || !cognome || !dataNascita || !sesso || !codiceComuneNascita) {
    return null;
  }

  try {
    const codice15 =
      calcolaCognome(cognome) +
      calcolaNome(nome) +
      calcolaDataSesso(dataNascita, sesso) +
      codiceComuneNascita.toUpperCase();

    return codice15 + calcolaCarattereControllo(codice15);
  } catch (error) {
    console.error('Errore nel calcolo del codice fiscale:', error);
    return null;
  }
}

export function validaCodiceFiscale(cf: string): boolean {
  if (!cf || cf.length !== 16) {
    return false;
  }

  const cfUpper = cf.toUpperCase();
  const codice15 = cfUpper.substring(0, 15);
  return cfUpper[15] === calcolaCarattereControllo(codice15);
}
