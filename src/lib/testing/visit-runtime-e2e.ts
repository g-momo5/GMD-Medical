import PizZip from 'pizzip';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { getAllAmbulatori } from '$lib/db/ambulatori';
import { getAllUsers } from '$lib/db/auth';
import { createPaziente, deletePaziente } from '$lib/db/pazienti';
import { createVisitaCompleta } from '$lib/db/visite-complete';
import { deleteVisita } from '$lib/db/visite';
import type {
  CreatePazienteInput,
  CreateVisitaInput,
  DiabeteTipo,
  EsamiEmaticiValues,
  FirmeVisita,
  Paziente,
  PianificazioneFollowUp,
  TerapiaIpolipemizzante,
  ValutazioneRischioCardiovascolare
} from '$lib/db/types';
import { generateVisitaReferto } from '$lib/reports/generateVisitaReferto';
import { DefaultE2ECollector, setActiveE2ECollector } from './e2e-collector';
import {
  createEmptyEsamiEmatici,
  createEmptyFirmeVisita,
  createEmptyPianificazioneFollowUp,
  createEmptyTerapiaIpolipemizzante,
  normalizeValutazioneRischioCV,
  serializeEsamiEmatici,
  serializeFirmeVisita,
  serializePianificazioneFollowUp,
  serializeTerapiaIpolipemizzante,
  serializeValutazioneRischioCV,
  validateTerapiaIpolipemizzante
} from '$lib/utils/visit-clinical';
import type {
  E2EConfig as TestingE2EConfig,
  E2EErrorRecord,
  E2EOutcome,
  E2EToastRecord,
  VisitE2ETestCaseResult
} from './e2e-types';

type RuntimeMode = 'smoke' | 'field-sweep';

type RuntimeFormData = {
  data_visita: string;
  tipo_visita: string;
  motivo: string;
  altezza: string;
  peso: string;
  bmi: string;
  bsa: string;
  anamnesi: string;
  esame_obiettivo: string;
  diagnosi: string;
  terapia: string;
  note: string;
};

type RuntimeFattoriRischio = {
  familiarita: boolean;
  familiarita_note: string;
  ipertensione: boolean;
  diabete: boolean;
  diabete_durata: string;
  diabete_tipo: DiabeteTipo;
  dislipidemia: boolean;
  obesita: boolean;
  fumo: string;
  fumo_ex_eta: string;
};

type RuntimeFixture = {
  paziente: Omit<CreatePazienteInput, 'ambulatorio_id'>;
  visita: {
    formData: RuntimeFormData;
    fattoriRischio: RuntimeFattoriRischio;
    anamnesiCardiologica: string;
    terapiaDomiciliare: string;
    valutazioneOdierna: string;
    esamiEmatici: EsamiEmaticiValues;
    terapiaIpolipemizzante: TerapiaIpolipemizzante;
    valutazioneRischioCV: ValutazioneRischioCardiovascolare;
    conclusioni: string;
    pianificazioneFollowUp: PianificazioneFollowUp;
    firmeVisita: FirmeVisita;
  };
};

type RuntimeCaseDefinition = {
  id: string;
  name: string;
  section: string;
  field: string;
  variant: string;
  expectedOutcome: E2EOutcome;
  generateReport?: boolean;
  patch?: Partial<RuntimeFixture>;
};

export type RuntimeVisitE2ESuiteResult = {
  status: 'passed' | 'failed';
  startedAt: string;
  finishedAt: string;
  mode: RuntimeMode;
  summary: {
    totalCases: number;
    passedCases: number;
    failedCases: number;
  };
  cases: VisitE2ETestCaseResult[];
  globalErrors: E2EErrorRecord[];
  globalToasts: E2EToastRecord[];
  resultPath: string;
};

const REQUIRED_DOCX_PLACEHOLDERS = ['{titolo}', '{nome}', '{cognome}', '{data_visita}'];

function nowIso(): string {
  return new Date().toISOString();
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepMerge<T>(base: T, patch?: Partial<T>): T {
  if (!patch) {
    return deepClone(base);
  }

  if (Array.isArray(base) || Array.isArray(patch)) {
    return deepClone((patch as T | undefined) ?? base);
  }

  if (typeof base !== 'object' || base === null || typeof patch !== 'object' || patch === null) {
    return deepClone((patch as T | undefined) ?? base);
  }

  const result = { ...(deepClone(base) as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const currentValue = result[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      currentValue &&
      typeof currentValue === 'object' &&
      !Array.isArray(currentValue)
    ) {
      result[key] = deepMerge(currentValue as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = deepClone(value);
    }
  }

  return result as T;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object') {
    const maybeMessage =
      'message' in error && typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : '';
    if (maybeMessage.trim()) {
      return maybeMessage;
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') {
        return serialized;
      }
    } catch {
      // ignore JSON serialization failures
    }
  }

  return 'Errore sconosciuto';
}

function normalizeReal(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildUniqueCodiceFiscale(base: string): string {
  const prefix = base.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10).padEnd(10, 'X');
  const suffix = Math.random().toString(36).replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return `${prefix}${suffix.slice(0, 6).padEnd(6, '0')}`.slice(0, 16);
}

function createCaseResultSkeleton(
  definition: RuntimeCaseDefinition,
  phase: VisitE2ETestCaseResult['phase']
): VisitE2ETestCaseResult {
  const startedAt = nowIso();
  return {
    id: definition.id,
    name: definition.name,
    phase,
    section: definition.section,
    field: definition.field,
    variant: definition.variant,
    status: 'passed',
    expectedOutcome: definition.expectedOutcome,
    actualOutcome: 'save-fail',
    errors: [],
    toasts: [],
    assertions: [],
    startedAt,
    finishedAt: startedAt
  };
}

function pushAssertion(
  result: VisitE2ETestCaseResult,
  name: string,
  passed: boolean,
  details?: string
) {
  result.assertions.push({
    name,
    passed,
    details,
    timestamp: nowIso()
  });
}

function pushError(
  result: VisitE2ETestCaseResult,
  source: E2EErrorRecord['source'],
  phase: E2EErrorRecord['phase'],
  message: string,
  options?: { fatal?: boolean; stack?: string; details?: string }
) {
  result.errors.push({
    source,
    phase,
    message,
    fatal: options?.fatal ?? false,
    stack: options?.stack,
    details: options?.details,
    timestamp: nowIso()
  });
}

function buildBaselineFixture(): RuntimeFixture {
  const esamiEmatici = createEmptyEsamiEmatici();
  esamiEmatici.ldl_calcolato = '68';
  esamiEmatici.colesterolo_totale = '150';
  esamiEmatici.hdl = '52';
  esamiEmatici.trigliceridi = '110';

  const valutazioneRischioCV = normalizeValutazioneRischioCV(
    {
      rischio: 'alto'
    },
    esamiEmatici
  );

  const terapiaIpolipemizzante = createEmptyTerapiaIpolipemizzante();
  terapiaIpolipemizzante.statine = {
    enabled: true,
    dose: 'Rosuvastatina 20 mg'
  };
  terapiaIpolipemizzante.ezetimibe = {
    enabled: true,
    modalita: '10 mg/die'
  };

  const pianificazioneFollowUp = createEmptyPianificazioneFollowUp();
  pianificazioneFollowUp.dataOraProssimaVisita = '2026-06-15T09:00';
  pianificazioneFollowUp.motivoProssimaVisita = 'Controllo profilo lipidico';

  const firmeVisita = createEmptyFirmeVisita();
  firmeVisita.cardiologoNome = 'Mario Rossi';
  firmeVisita.cardiologoTitolo = 'dott';
  firmeVisita.mediciInFormazione = [{ nome: 'Giulia Bianchi', titolo: 'dott.ssa' }];

  return {
    paziente: {
      nome: 'Runtime',
      cognome: 'Tester',
      data_nascita: '1980-01-10',
      luogo_nascita: 'Sassari',
      codice_fiscale: 'RNTTST80A10I452Q',
      sesso: 'M',
      esenzioni: '',
      indirizzo: 'Via Runtime 1',
      citta: 'Sassari',
      cap: '07100',
      provincia: 'SS',
      telefono: '3330000000',
      email: 'runtime@example.com'
    },
    visita: {
      formData: {
        data_visita: '2026-03-02T09:30',
        tipo_visita: 'Prima visita',
        motivo: 'Valutazione dislipidemia',
        altezza: '172',
        peso: '78',
        bmi: '26.37',
        bsa: '1.92',
        anamnesi: 'Ipercolesterolemia nota.',
        esame_obiettivo: 'Nulla di patologico.',
        diagnosi: 'Dislipidemia mista.',
        terapia: 'Prosegue terapia.',
        note: 'Caso runtime e2e.'
      },
      fattoriRischio: {
        familiarita: true,
        familiarita_note: 'Padre con IMA a 52 anni',
        ipertensione: false,
        diabete: false,
        diabete_durata: '',
        diabete_tipo: '',
        dislipidemia: true,
        obesita: false,
        fumo: 'no',
        fumo_ex_eta: ''
      },
      anamnesiCardiologica: 'Nessun evento cardiovascolare documentato.',
      terapiaDomiciliare: 'Ramipril 5 mg',
      valutazioneOdierna: 'Quadro clinico stabile.',
      esamiEmatici,
      terapiaIpolipemizzante,
      valutazioneRischioCV,
      conclusioni: 'Si conferma indicazione a terapia ipolipemizzante intensiva.',
      pianificazioneFollowUp,
      firmeVisita
    }
  };
}

function buildRuntimeFieldCases(): RuntimeCaseDefinition[] {
  return [
    {
      id: 'runtime-missing-tipo-visita',
      name: 'Tipo visita mancante',
      section: 'header',
      field: 'tipo_visita',
      variant: 'empty',
      expectedOutcome: 'save-fail',
      patch: {
        visita: {
          formData: {
            tipo_visita: ''
          }
        }
      }
    },
    {
      id: 'runtime-anthropometry-decimals',
      name: 'Dati antropometrici decimali',
      section: 'dati-antropometrici',
      field: 'altezza-peso',
      variant: 'decimal-values',
      expectedOutcome: 'save-success',
      patch: {
        visita: {
          formData: {
            altezza: '172.5',
            peso: '78.4',
            bmi: '26.34',
            bsa: '1.93'
          }
        }
      }
    },
    {
      id: 'runtime-diabete-senza-tipo',
      name: 'Diabete senza tipo',
      section: 'fattori-rischio-cv',
      field: 'diabete_tipo',
      variant: 'missing-required-when-diabete',
      expectedOutcome: 'save-fail',
      patch: {
        visita: {
          fattoriRischio: {
            diabete: true,
            diabete_tipo: ''
          }
        }
      }
    },
    {
      id: 'runtime-complete-followup-report',
      name: 'Follow-up completo con referto',
      section: 'follow-up',
      field: 'pianificazione_followup',
      variant: 'with-report',
      expectedOutcome: 'report-success',
      generateReport: true,
      patch: {
        visita: {
          pianificazioneFollowUp: {
            dataOraProssimaVisita: '2026-09-10T10:15',
            motivoProssimaVisita: 'Verifica risposta terapeutica',
            esamiEmaticiDaFare: 'Assetto lipidico, AST, ALT, CPK'
          },
          firmeVisita: {
            cardiologoNome: 'Lucia Verdi',
            cardiologoTitolo: 'dott.ssa',
            mediciInFormazione: [
              { nome: 'Paolo Neri', titolo: 'dott' },
              { nome: 'Anna Serra', titolo: 'dott.ssa' }
            ]
          }
        }
      }
    }
  ];
}

function validateFixture(fixture: RuntimeFixture): string[] {
  const errors: string[] = [];
  const { visita } = fixture;

  if (!visita.formData.tipo_visita.trim()) {
    errors.push('Seleziona il tipo di visita');
  }
  if (!visita.formData.motivo.trim()) {
    errors.push('Inserisci il motivo della visita');
  }
  if (visita.fattoriRischio.diabete && !visita.fattoriRischio.diabete_tipo.trim()) {
    errors.push('Seleziona il tipo di diabete mellito');
  }

  const terapiaValidation = validateTerapiaIpolipemizzante(visita.terapiaIpolipemizzante);
  if (terapiaValidation) {
    errors.push(terapiaValidation);
  }

  return errors;
}

function buildVisitaInput(
  fixture: RuntimeFixture,
  ambulatorioId: number,
  pazienteId: number,
  medicoId: number
): CreateVisitaInput {
  const normalizedRisk = normalizeValutazioneRischioCV(
    fixture.visita.valutazioneRischioCV,
    fixture.visita.esamiEmatici
  );

  return {
    ambulatorio_id: ambulatorioId,
    paziente_id: pazienteId,
    medico_id: medicoId,
    data_visita: fixture.visita.formData.data_visita,
    tipo_visita: fixture.visita.formData.tipo_visita,
    motivo: fixture.visita.formData.motivo,
    altezza: normalizeReal(fixture.visita.formData.altezza) ?? undefined,
    peso: normalizeReal(fixture.visita.formData.peso) ?? undefined,
    bmi: normalizeReal(fixture.visita.formData.bmi) ?? undefined,
    bsa: normalizeReal(fixture.visita.formData.bsa) ?? undefined,
    anamnesi_cardiologica: fixture.visita.anamnesiCardiologica,
    terapia_domiciliare: fixture.visita.terapiaDomiciliare,
    valutazione_odierna: fixture.visita.valutazioneOdierna,
    esami_ematici: serializeEsamiEmatici(fixture.visita.esamiEmatici),
    terapia_ipolipemizzante: serializeTerapiaIpolipemizzante(fixture.visita.terapiaIpolipemizzante),
    valutazione_rischio_cv: serializeValutazioneRischioCV(
      normalizedRisk,
      fixture.visita.esamiEmatici
    ),
    firme_visita: serializeFirmeVisita(fixture.visita.firmeVisita),
    pianificazione_followup: serializePianificazioneFollowUp(fixture.visita.pianificazioneFollowUp),
    conclusioni: fixture.visita.conclusioni,
    anamnesi: fixture.visita.formData.anamnesi,
    esame_obiettivo: fixture.visita.formData.esame_obiettivo,
    diagnosi: fixture.visita.formData.diagnosi,
    terapia: fixture.visita.formData.terapia,
    note: fixture.visita.formData.note
  };
}

function buildPazienteRecord(
  id: number,
  ambulatorioId: number,
  data: RuntimeFixture['paziente']
): Paziente {
  const timestamp = nowIso();
  return {
    id,
    ambulatorio_id: ambulatorioId,
    nome: data.nome,
    cognome: data.cognome,
    data_nascita: data.data_nascita,
    luogo_nascita: data.luogo_nascita,
    codice_fiscale: data.codice_fiscale,
    sesso: data.sesso,
    esenzioni: data.esenzioni || '',
    indirizzo: data.indirizzo || '',
    citta: data.citta || '',
    cap: data.cap || '',
    provincia: data.provincia || '',
    telefono: data.telefono || '',
    email: data.email || '',
    created_at: timestamp,
    updated_at: timestamp
  };
}

async function verifyDocx(path: string): Promise<{
  sizeBytes: number;
  placeholderResiduals: string[];
}> {
  const raw = await readFile(path);
  const bytes = raw instanceof Uint8Array ? raw : Uint8Array.from(raw as ArrayLike<number>);
  const zip = new PizZip(bytes);
  const documentXml = zip.file('word/document.xml')?.asText() || '';

  return {
    sizeBytes: bytes.byteLength,
    placeholderResiduals: REQUIRED_DOCX_PLACEHOLDERS.filter((placeholder) =>
      documentXml.includes(placeholder)
    )
  };
}

function mergeCollector(
  result: VisitE2ETestCaseResult,
  collector: DefaultE2ECollector
): VisitE2ETestCaseResult {
  result.toasts.push(...collector.toasts);
  result.errors.push(...collector.errors);
  result.assertions.push(...collector.assertions);
  return result;
}

async function runRuntimeCase(
  definition: RuntimeCaseDefinition,
  phase: VisitE2ETestCaseResult['phase'],
  config: TestingE2EConfig
): Promise<VisitE2ETestCaseResult> {
  const result = createCaseResultSkeleton(definition, phase);
  const fixture = deepMerge(buildBaselineFixture(), definition.patch);
  const validationErrors = validateFixture(fixture);

  if (validationErrors.length > 0) {
    for (const message of validationErrors) {
      pushError(result, 'validation', 'validation', message, { fatal: false });
    }
    result.actualOutcome = 'save-fail';
    result.status = result.actualOutcome === result.expectedOutcome ? 'passed' : 'failed';
    result.finishedAt = nowIso();
    return result;
  }

  const collector = new DefaultE2ECollector();
  let createdVisitId: number | null = null;
  let createdPazienteId: number | null = null;

  try {
    setActiveE2ECollector(collector);

    const [ambulatorio] = await getAllAmbulatori();
    const [user] = await getAllUsers();

    if (!ambulatorio || !user) {
      collector.recordError(
        'runtime',
        'bootstrap',
        'Runner runtime e2e: mancano ambulatorio o utente nel database.',
        { fatal: true }
      );
      result.actualOutcome = 'save-fail';
      return mergeCollector(result, collector);
    }

    const pazienteInput: CreatePazienteInput = {
      ambulatorio_id: ambulatorio.id,
      ...fixture.paziente,
      codice_fiscale: buildUniqueCodiceFiscale(fixture.paziente.codice_fiscale)
    };

    createdPazienteId = await createPaziente(pazienteInput);
    const paziente = buildPazienteRecord(createdPazienteId, ambulatorio.id, pazienteInput);
    const visitaInput = buildVisitaInput(fixture, ambulatorio.id, createdPazienteId, user.id);

    createdVisitId = await createVisitaCompleta({
      visita: visitaInput,
      fattoriRischioCV: fixture.visita.fattoriRischio
    });
    result.createdVisitId = createdVisitId;
    result.actualOutcome = 'save-success';

    if (definition.generateReport) {
      const reportPath = `${config.runtimeOutputDir.replace(/\/+$/, '')}/${definition.id}-${createdVisitId}.docx`;
      const reportResult = await generateVisitaReferto(
        {
          paziente,
          formData: {
            data_visita: fixture.visita.formData.data_visita,
            tipo_visita: fixture.visita.formData.tipo_visita,
            motivo: fixture.visita.formData.motivo,
            altezza: fixture.visita.formData.altezza,
            peso: fixture.visita.formData.peso,
            bmi: fixture.visita.formData.bmi
          },
          fattoriRischio: fixture.visita.fattoriRischio,
          anamnesiPatologicaRemota: fixture.visita.anamnesiCardiologica,
          terapiaIpolipemizzante: fixture.visita.terapiaIpolipemizzante,
          terapiaDomiciliare: fixture.visita.terapiaDomiciliare,
          esamiEmatici: fixture.visita.esamiEmatici,
          valutazioneRischioCV: normalizeValutazioneRischioCV(
            fixture.visita.valutazioneRischioCV,
            fixture.visita.esamiEmatici
          ),
          conclusioni: fixture.visita.conclusioni,
          pianificazioneFollowUp: fixture.visita.pianificazioneFollowUp,
          firmeVisita: fixture.visita.firmeVisita,
          visitaId: createdVisitId
        },
        {
          saveMode: 'fixed-path',
          fixedPath: reportPath,
          collector
        }
      );

      if (!reportResult.saved || !reportResult.path) {
        collector.recordError(
          'report',
          'report',
          'Il runner runtime non ha ottenuto un percorso valido per il referto.',
          { fatal: true }
        );
        result.actualOutcome = 'report-fail';
      } else {
        result.reportPath = reportResult.path;
        result.actualOutcome = 'report-success';

        const verification = await verifyDocx(reportResult.path);
        collector.recordAssertion(
          'runtime-docx-file-non-empty',
          verification.sizeBytes > 0,
          `Dimensione file: ${verification.sizeBytes} byte`
        );
        collector.recordAssertion(
          'runtime-docx-required-placeholders-replaced',
          verification.placeholderResiduals.length === 0,
          verification.placeholderResiduals.length === 0
            ? 'Tutti i placeholder obbligatori sono stati sostituiti.'
            : `Placeholder residui: ${verification.placeholderResiduals.join(', ')}`
        );
      }
    }
  } catch (error) {
    const phaseName = result.actualOutcome === 'save-success' ? 'report' : 'db';
    if (phaseName === 'db') {
      collector.recordError('db', 'db', getErrorMessage(error), {
        fatal: true,
        stack: error instanceof Error ? error.stack : undefined
      });
      result.actualOutcome = 'save-fail';
    } else {
      result.actualOutcome = 'report-fail';
    }
  } finally {
    if (createdVisitId !== null) {
      try {
        await deleteVisita(createdVisitId);
      } catch (error) {
        collector.recordError('runtime', 'runtime', `Cleanup visita fallito: ${getErrorMessage(error)}`, {
          fatal: false,
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    if (createdPazienteId !== null) {
      try {
        await deletePaziente(createdPazienteId);
      } catch (error) {
        collector.recordError(
          'runtime',
          'runtime',
          `Cleanup paziente fallito: ${getErrorMessage(error)}`,
          {
            fatal: false,
            stack: error instanceof Error ? error.stack : undefined
          }
        );
      }
    }

    setActiveE2ECollector(null);
  }

  mergeCollector(result, collector);

  const assertionsPassed = result.assertions.every((entry) => entry.passed);
  const outcomeMatches = result.actualOutcome === result.expectedOutcome;
  const fatalErrors = result.errors.some((entry) => entry.fatal);
  const expectedFailure =
    result.expectedOutcome === 'save-fail' || result.expectedOutcome === 'report-fail';

  result.status =
    outcomeMatches && assertionsPassed && (expectedFailure || !fatalErrors) ? 'passed' : 'failed';
  result.finishedAt = nowIso();

  return result;
}

function buildSuiteResult(
  cases: VisitE2ETestCaseResult[],
  mode: RuntimeMode,
  resultPath: string
): RuntimeVisitE2ESuiteResult {
  const startedAt = cases[0]?.startedAt || nowIso();
  const finishedAt = nowIso();
  const failedCases = cases.filter((entry) => entry.status === 'failed');

  return {
    status: failedCases.length === 0 ? 'passed' : 'failed',
    startedAt,
    finishedAt,
    mode,
    summary: {
      totalCases: cases.length,
      passedCases: cases.filter((entry) => entry.status === 'passed').length,
      failedCases: failedCases.length
    },
    cases,
    globalErrors: cases.flatMap((entry) => entry.errors),
    globalToasts: cases.flatMap((entry) => entry.toasts),
    resultPath
  };
}

function buildSuitePath(config: TestingE2EConfig, mode: RuntimeMode): string {
  const fileName =
    mode === 'smoke' ? 'visit-report-runtime-result.json' : 'visit-field-sweep-runtime-result.json';
  return `${config.runtimeOutputDir.replace(/\/+$/, '')}/${fileName}`;
}

export async function runRuntimeVisitSuite(
  mode: RuntimeMode,
  config: TestingE2EConfig
): Promise<RuntimeVisitE2ESuiteResult> {
  const definitions: RuntimeCaseDefinition[] =
    mode === 'smoke'
      ? [
          {
            id: 'runtime-smoke-baseline',
            name: 'Smoke runtime con moduli reali',
            section: 'runtime',
            field: 'baseline',
            variant: 'default',
            expectedOutcome: 'report-success',
            generateReport: true
          }
        ]
      : buildRuntimeFieldCases();

  const phase: VisitE2ETestCaseResult['phase'] =
    mode === 'smoke' ? 'runtime-smoke' : 'runtime-field-sweep';
  const cases: VisitE2ETestCaseResult[] = [];

  for (const definition of definitions) {
    cases.push(await runRuntimeCase(definition, phase, config));
  }

  const resultPath = buildSuitePath(config, mode);
  const suite = buildSuiteResult(cases, mode, resultPath);
  await writeFile(resultPath, new TextEncoder().encode(`${JSON.stringify(suite, null, 2)}\n`), {
    create: true
  });

  return suite;
}
