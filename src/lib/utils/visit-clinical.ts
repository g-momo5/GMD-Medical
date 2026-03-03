import { bempedoicoDose, defaultFollowUpEsamiEmatici } from '$lib/configs/clinical-options';
import type {
  DoseSelection,
  EzetimibeSelection,
  EsamiEmaticiValues,
  FHAssessment,
  FirmeVisita,
  LDLSource,
  PianificazioneFollowUp,
  RischioCVLevel,
  StatinaSelection,
  TerapiaIpolipemizzante,
  ValutazioneRischioCardiovascolare
} from '$lib/db/types';
import { calculateDutchLipidScore } from './dutch-lipid-score';

const emptyEsamiEmatici: EsamiEmaticiValues = {
  hb: '',
  plt: '',
  creatinina: '',
  egfr: '',
  colesterolo_totale: '',
  hdl: '',
  trigliceridi: '',
  ldl_calcolato: '',
  ldl_diretto: '',
  lipoproteina_a: '',
  emoglobina_glicata: '',
  glicemia: '',
  ast: '',
  alt: '',
  bilirubina_totale: '',
  cpk: ''
};

// 2025 ESC focused update: the four general LDL-C goals remain unchanged vs 2019 ESC/EAS.
const rischioTargets: Record<Exclude<RischioCVLevel, ''>, number> = {
  basso: 116,
  moderato: 100,
  alto: 70,
  molto_alto: 55
};

function createEmptyDoseSelection(): DoseSelection {
  return {
    enabled: false,
    dose: ''
  };
}

function createEmptyStatinaSelection(): StatinaSelection {
  return {
    enabled: false,
    dose: ''
  };
}

function createEmptyEzetimibeSelection(): EzetimibeSelection {
  return {
    enabled: false,
    modalita: ''
  };
}

function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  const normalized = String(value).replace(',', '.').trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveCurrentLdl(
  esami: EsamiEmaticiValues
): { value: number | null; source: LDLSource } {
  const ldlDiretto = toNullableNumber(esami.ldl_diretto);
  if (ldlDiretto !== null) {
    return {
      value: ldlDiretto,
      source: 'diretto'
    };
  }

  const ldlCalcolato = toNullableNumber(esami.ldl_calcolato);
  if (ldlCalcolato !== null) {
    return {
      value: ldlCalcolato,
      source: 'calcolato'
    };
  }

  return {
    value: null,
    source: ''
  };
}

export function createEmptyEsamiEmatici(): EsamiEmaticiValues {
  return {
    ...emptyEsamiEmatici
  };
}

export function normalizeEsamiEmatici(input?: Partial<EsamiEmaticiValues> | null): EsamiEmaticiValues {
  const merged = {
    ...emptyEsamiEmatici,
    ...(input || {})
  };

  const normalized = createEmptyEsamiEmatici();
  for (const key of Object.keys(emptyEsamiEmatici) as Array<keyof EsamiEmaticiValues>) {
    const value = merged[key];
    normalized[key] = typeof value === 'string' ? value : value == null ? '' : String(value);
  }

  return normalized;
}

export function parseEsamiEmatici(raw?: string | null): EsamiEmaticiValues {
  if (!raw) return createEmptyEsamiEmatici();

  try {
    return normalizeEsamiEmatici(JSON.parse(raw) as Partial<EsamiEmaticiValues>);
  } catch {
    return createEmptyEsamiEmatici();
  }
}

export function serializeEsamiEmatici(data: EsamiEmaticiValues): string {
  return JSON.stringify(normalizeEsamiEmatici(data));
}

export function createEmptyValutazioneRischioCV(): ValutazioneRischioCardiovascolare {
  return {
    rischio: '',
    targetLdl: null,
    ldlAttuale: null,
    ldlSource: '',
    status: 'non_valutabile',
    statusMessage: 'Seleziona il rischio cardiovascolare'
  };
}

export function normalizeValutazioneRischioCV(
  input: Partial<ValutazioneRischioCardiovascolare> | null | undefined,
  esami: EsamiEmaticiValues
): ValutazioneRischioCardiovascolare {
  const merged = {
    ...createEmptyValutazioneRischioCV(),
    ...(input || {})
  };
  const rischio: RischioCVLevel =
    merged.rischio === 'basso' ||
    merged.rischio === 'moderato' ||
    merged.rischio === 'alto' ||
    merged.rischio === 'molto_alto'
      ? merged.rischio
      : '';
  const ldl = resolveCurrentLdl(normalizeEsamiEmatici(esami));

  if (!rischio) {
    return {
      rischio: '',
      targetLdl: null,
      ldlAttuale: ldl.value,
      ldlSource: ldl.source,
      status: 'non_valutabile',
      statusMessage: 'Seleziona il rischio cardiovascolare'
    };
  }

  const targetLdl = rischioTargets[rischio];
  if (ldl.value === null) {
    return {
      rischio,
      targetLdl,
      ldlAttuale: null,
      ldlSource: '',
      status: 'non_valutabile',
      statusMessage: 'Inserire LDL diretto o LDL calcolato'
    };
  }

  const status = ldl.value < targetLdl ? 'raggiunto' : 'non_raggiunto';
  return {
    rischio,
    targetLdl,
    ldlAttuale: ldl.value,
    ldlSource: ldl.source,
    status,
    statusMessage: status === 'raggiunto' ? 'Target raggiunto' : 'Target non raggiunto'
  };
}

export function parseValutazioneRischioCV(
  raw: string | null | undefined,
  esami: EsamiEmaticiValues
): ValutazioneRischioCardiovascolare {
  if (!raw) return normalizeValutazioneRischioCV(null, esami);

  try {
    return normalizeValutazioneRischioCV(
      JSON.parse(raw) as Partial<ValutazioneRischioCardiovascolare>,
      esami
    );
  } catch {
    return normalizeValutazioneRischioCV(null, esami);
  }
}

export function serializeValutazioneRischioCV(
  data: ValutazioneRischioCardiovascolare,
  esami: EsamiEmaticiValues
): string {
  return JSON.stringify(normalizeValutazioneRischioCV(data, esami));
}

export function isValutazioneRischioCVEqual(
  left: ValutazioneRischioCardiovascolare,
  right: ValutazioneRischioCardiovascolare
): boolean {
  return (
    left.rischio === right.rischio &&
    left.targetLdl === right.targetLdl &&
    left.ldlAttuale === right.ldlAttuale &&
    left.ldlSource === right.ldlSource &&
    left.status === right.status &&
    left.statusMessage === right.statusMessage
  );
}

export function createEmptyPianificazioneFollowUp(): PianificazioneFollowUp {
  return {
    dataOraProssimaVisita: '',
    motivoProssimaVisita: '',
    esamiEmaticiDaFare: defaultFollowUpEsamiEmatici
  };
}

export function normalizePianificazioneFollowUp(
  input?: Partial<PianificazioneFollowUp> | null
): PianificazioneFollowUp {
  const hasEsamiEmaticiDaFare =
    input !== null &&
    input !== undefined &&
    Object.prototype.hasOwnProperty.call(input, 'esamiEmaticiDaFare');
  const rawEsamiEmaticiDaFare = typeof input?.esamiEmaticiDaFare === 'string'
    ? input.esamiEmaticiDaFare.trim()
    : undefined;

  return {
    dataOraProssimaVisita:
      typeof input?.dataOraProssimaVisita === 'string' ? input.dataOraProssimaVisita.trim() : '',
    motivoProssimaVisita:
      typeof input?.motivoProssimaVisita === 'string' ? input.motivoProssimaVisita.trim() : '',
    esamiEmaticiDaFare: hasEsamiEmaticiDaFare
      ? (rawEsamiEmaticiDaFare ?? '')
      : defaultFollowUpEsamiEmatici
  };
}

export function parsePianificazioneFollowUp(raw?: string | null): PianificazioneFollowUp {
  if (!raw) return createEmptyPianificazioneFollowUp();

  try {
    return normalizePianificazioneFollowUp(JSON.parse(raw) as Partial<PianificazioneFollowUp>);
  } catch {
    return createEmptyPianificazioneFollowUp();
  }
}

export function serializePianificazioneFollowUp(data: PianificazioneFollowUp): string {
  return JSON.stringify(normalizePianificazioneFollowUp(data));
}

export function createEmptyFirmeVisita(): FirmeVisita {
  return {
    cardiologoNome: '',
    cardiologoTitolo: 'dott',
    mediciInFormazione: [{ nome: '', titolo: 'dott' }]
  };
}

export function normalizeFirmeVisita(input?: Partial<FirmeVisita> | null): FirmeVisita {
  const cardiologoNome = typeof input?.cardiologoNome === 'string' ? input.cardiologoNome.trim() : '';
  const cardiologoTitolo = input?.cardiologoTitolo === 'dott.ssa' ? 'dott.ssa' : 'dott';
  const rawMedici = Array.isArray(input?.mediciInFormazione) ? input.mediciInFormazione : [];

  return {
    cardiologoNome,
    cardiologoTitolo,
    mediciInFormazione: rawMedici
      .map((value) => {
        if (typeof value === 'string') {
          return {
            nome: value.trim(),
            titolo: 'dott' as const
          };
        }

        if (value && typeof value === 'object') {
          const record = value as { nome?: unknown; titolo?: unknown };
          return {
            nome: typeof record.nome === 'string' ? record.nome.trim() : '',
            titolo: record.titolo === 'dott.ssa' ? 'dott.ssa' : 'dott'
          };
        }

        return {
          nome: '',
          titolo: 'dott' as const
        };
      })
      .filter((value) => value.nome.length > 0)
  };
}

export function parseFirmeVisita(raw?: string | null): FirmeVisita {
  if (!raw) return createEmptyFirmeVisita();

  try {
    const normalized = normalizeFirmeVisita(JSON.parse(raw) as Partial<FirmeVisita>);
    return {
      cardiologoNome: normalized.cardiologoNome,
      cardiologoTitolo: normalized.cardiologoTitolo,
      mediciInFormazione:
        normalized.mediciInFormazione.length > 0
          ? normalized.mediciInFormazione
          : [{ nome: '', titolo: 'dott' }]
    };
  } catch {
    return createEmptyFirmeVisita();
  }
}

export function serializeFirmeVisita(data: FirmeVisita): string {
  return JSON.stringify(normalizeFirmeVisita(data));
}

export function createEmptyFHAssessment(): FHAssessment {
  return {
    enabled: false,
    familyHistoryOnePoint: false,
    familyHistoryTwoPoints: false,
    clinicalPrematureCAD: false,
    clinicalPrematureCerebralOrPeripheral: false,
    physicalTendonXanthomas: false,
    physicalCornealArcusBefore45: false,
    untreatedLdlRange: '',
    geneticMutation: false,
    totalScore: 0,
    classification: 'Improbabile'
  };
}

export function normalizeFHAssessment(input?: Partial<FHAssessment> | null): FHAssessment {
  const base = createEmptyFHAssessment();
  const merged = {
    ...base,
    ...(input || {})
  };

  if (!merged.enabled) {
    return base;
  }

  const { total, classification } = calculateDutchLipidScore(merged);
  return {
    ...merged,
    totalScore: total,
    classification
  };
}

export function parseFHAssessment(raw?: string | null): FHAssessment {
  if (!raw) return createEmptyFHAssessment();

  try {
    return normalizeFHAssessment(JSON.parse(raw) as Partial<FHAssessment>);
  } catch {
    return createEmptyFHAssessment();
  }
}

export function serializeFHAssessment(data: FHAssessment): string {
  return JSON.stringify(normalizeFHAssessment(data));
}

export function validateFHAssessment(data: FHAssessment): string | null {
  const normalized = normalizeFHAssessment(data);

  if (normalized.enabled && !normalized.untreatedLdlRange) {
    return 'Nel profilo lipidico della FH devi selezionare una fascia LDL';
  }

  return null;
}

export function createEmptyTerapiaIpolipemizzante(): TerapiaIpolipemizzante {
  return {
    statine: createEmptyStatinaSelection(),
    ezetimibe: createEmptyEzetimibeSelection(),
    fibrati: createEmptyDoseSelection(),
    omega3: createEmptyDoseSelection(),
    acido_bempedoico: createEmptyDoseSelection(),
    repatha: createEmptyDoseSelection(),
    praluent: createEmptyDoseSelection(),
    leqvio: createEmptyDoseSelection()
  };
}

function normalizeDoseSelection(input?: Partial<DoseSelection> | null): DoseSelection {
  const merged = {
    ...createEmptyDoseSelection(),
    ...(input || {})
  };

  if (!merged.enabled) {
    return createEmptyDoseSelection();
  }

  return merged;
}

function normalizeStatinaSelection(input?: Partial<StatinaSelection> | null): StatinaSelection {
  const merged = {
    ...createEmptyStatinaSelection(),
    ...(input || {})
  };

  if (!merged.enabled) {
    return createEmptyStatinaSelection();
  }

  return merged;
}

function normalizeEzetimibeSelection(input?: Partial<EzetimibeSelection> | null): EzetimibeSelection {
  const merged = {
    ...createEmptyEzetimibeSelection(),
    ...(input || {})
  };

  if (!merged.enabled) {
    return createEmptyEzetimibeSelection();
  }

  return merged;
}

export function normalizeTerapiaIpolipemizzante(
  input?: Partial<TerapiaIpolipemizzante> | null
): TerapiaIpolipemizzante {
  const base = createEmptyTerapiaIpolipemizzante();
  const merged = {
    ...base,
    ...(input || {})
  };

  const acidoBempedoico = normalizeDoseSelection(merged.acido_bempedoico);

  return {
    statine: normalizeStatinaSelection(merged.statine),
    ezetimibe: normalizeEzetimibeSelection(merged.ezetimibe),
    fibrati: normalizeDoseSelection(merged.fibrati),
    omega3: normalizeDoseSelection(merged.omega3),
    acido_bempedoico: acidoBempedoico.enabled
      ? { enabled: true, dose: bempedoicoDose }
      : createEmptyDoseSelection(),
    repatha: normalizeDoseSelection(merged.repatha),
    praluent: normalizeDoseSelection(merged.praluent),
    leqvio: normalizeDoseSelection(merged.leqvio)
  };
}

export function parseTerapiaIpolipemizzante(raw?: string | null): TerapiaIpolipemizzante {
  if (!raw) return createEmptyTerapiaIpolipemizzante();

  try {
    return normalizeTerapiaIpolipemizzante(JSON.parse(raw) as Partial<TerapiaIpolipemizzante>);
  } catch {
    return createEmptyTerapiaIpolipemizzante();
  }
}

export function serializeTerapiaIpolipemizzante(data: TerapiaIpolipemizzante): string {
  return JSON.stringify(normalizeTerapiaIpolipemizzante(data));
}

export function validateTerapiaIpolipemizzante(data: TerapiaIpolipemizzante): string | null {
  const normalized = normalizeTerapiaIpolipemizzante(data);

  if (normalized.statine.enabled && !normalized.statine.dose) {
    return 'Seleziona statina e dosaggio';
  }

  if (normalized.ezetimibe.enabled && !normalized.ezetimibe.modalita) {
    return "Seleziona la modalita' di ezetimibe";
  }

  if (normalized.fibrati.enabled && !normalized.fibrati.dose) {
    return 'Seleziona la dose dei fibrati';
  }

  if (normalized.omega3.enabled && !normalized.omega3.dose) {
    return 'Seleziona la dose di Omega 3';
  }

  if (normalized.repatha.enabled && !normalized.repatha.dose) {
    return 'Seleziona la dose di Repatha';
  }

  if (normalized.praluent.enabled && !normalized.praluent.dose) {
    return 'Seleziona la dose di Praluent';
  }

  if (normalized.leqvio.enabled && !normalized.leqvio.dose) {
    return 'Seleziona la dose di Leqvio';
  }

  return null;
}
