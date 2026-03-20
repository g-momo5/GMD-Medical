import type { UntreatedLdlRange } from '$lib/db/types';

export interface SelectOption {
  value: string;
  label: string;
}

export const diabeteTipoOptions: SelectOption[] = [
  { value: '1', label: 'Tipo 1' },
  { value: '2', label: 'Tipo 2' }
];

export const fhUntreatedLdlOptions: Array<{ value: UntreatedLdlRange; label: string }> = [
  { value: '', label: 'Seleziona LDL non trattato' },
  { value: '155-189', label: '155-189 mg/dL' },
  { value: '190-249', label: '190-249 mg/dL' },
  { value: '250-329', label: '250-329 mg/dL' },
  { value: '>=330', label: '>=330 mg/dL' }
];

export const statinaDoseOptions: SelectOption[] = [
  { value: 'Atorvastatina 10 mg', label: 'Atorvastatina 10 mg' },
  { value: 'Atorvastatina 20 mg', label: 'Atorvastatina 20 mg' },
  { value: 'Atorvastatina 40 mg', label: 'Atorvastatina 40 mg' },
  { value: 'Atorvastatina 80 mg', label: 'Atorvastatina 80 mg' },
  { value: 'Rosuvastatina 5 mg', label: 'Rosuvastatina 5 mg' },
  { value: 'Rosuvastatina 10 mg', label: 'Rosuvastatina 10 mg' },
  { value: 'Rosuvastatina 20 mg', label: 'Rosuvastatina 20 mg' },
  { value: 'Rosuvastatina 40 mg', label: 'Rosuvastatina 40 mg' },
  { value: 'Simvastatina 10 mg', label: 'Simvastatina 10 mg' },
  { value: 'Simvastatina 20 mg', label: 'Simvastatina 20 mg' },
  { value: 'Simvastatina 40 mg', label: 'Simvastatina 40 mg' },
  { value: 'Simvastatina 80 mg', label: 'Simvastatina 80 mg' },
  { value: 'Pravastatina 10 mg', label: 'Pravastatina 10 mg' },
  { value: 'Pravastatina 20 mg', label: 'Pravastatina 20 mg' },
  { value: 'Pravastatina 40 mg', label: 'Pravastatina 40 mg' },
  { value: 'Fluvastatina 20 mg', label: 'Fluvastatina 20 mg' },
  { value: 'Fluvastatina 40 mg', label: 'Fluvastatina 40 mg' },
  { value: 'Fluvastatina 80 mg', label: 'Fluvastatina 80 mg' },
  { value: 'Pitavastatina 1 mg', label: 'Pitavastatina 1 mg' },
  { value: 'Pitavastatina 2 mg', label: 'Pitavastatina 2 mg' },
  { value: 'Pitavastatina 4 mg', label: 'Pitavastatina 4 mg' }
];

export const ezetimibeModeOptions: SelectOption[] = [
  { value: 'Senza associazione', label: 'Senza associazione' },
  { value: 'In associazione con statina', label: 'In associazione con statina' },
  { value: 'In associazione con acido bempedoico', label: 'In associazione con acido bempedoico' }
];

export const fibratiDoseOptions: SelectOption[] = [
  { value: 'Fenofibrato 145 mg', label: 'Fenofibrato 145 mg' },
  { value: 'Fenofibrato 160 mg', label: 'Fenofibrato 160 mg' },
  { value: 'Fenofibrato 200 mg', label: 'Fenofibrato 200 mg' },
  { value: 'Bezafibrato 200 mg x2/die', label: 'Bezafibrato 200 mg x2/die' },
  { value: 'Bezafibrato 400 mg RP', label: 'Bezafibrato 400 mg RP' },
  { value: 'Gemfibrozil 600 mg x2/die', label: 'Gemfibrozil 600 mg x2/die' }
];

export const omega3DoseOptions: SelectOption[] = [
  { value: '1 g/die', label: '1 g/die' },
  { value: '2 g/die', label: '2 g/die' },
  { value: '4 g/die', label: '4 g/die' }
];

export const repathaDoseOptions: SelectOption[] = [
  { value: '140 mg ogni 2 settimane', label: '140 mg ogni 2 settimane' },
  { value: '420 mg mensile', label: '420 mg mensile' }
];

export const praluentDoseOptions: SelectOption[] = [
  { value: '75 mg ogni 2 settimane', label: '75 mg ogni 2 settimane' },
  { value: '150 mg ogni 2 settimane', label: '150 mg ogni 2 settimane' },
  { value: '300 mg mensile', label: '300 mg mensile' }
];

export const leqvioDoseOptions: SelectOption[] = [
  { value: '284 mg ogni 6 mesi', label: '284 mg ogni 6 mesi' }
];

export const rischioCVOptions: SelectOption[] = [
  { value: 'basso', label: 'Basso' },
  { value: 'moderato', label: 'Moderato' },
  { value: 'alto', label: 'Alto' },
  { value: 'molto_alto', label: 'Molto alto' }
];

export const defaultFollowUpEsamiEmatici =
  'Emocromo, Glicemia, Emoglobina Glicata, Creatinina, eGFR, Sodio, Potassio, AST, ALT, GammaGT, Fosfatasi Alcalina, CPK, LDH, Colesterolo totale, HDL, Trigliceridi, LDL, LpA';

export const bempedoicoDose = '180 mg/die';
