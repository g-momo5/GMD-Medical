import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { resolveResource } from '@tauri-apps/api/path';
import { rischioCVOptions } from '$lib/configs/clinical-options';
import type {
  EsamiEmaticiValues,
  FirmeVisita,
  Paziente,
  PianificazioneFollowUp,
  TerapiaIpolipemizzante,
  TitoloFirmaMedico,
  ValutazioneRischioCardiovascolare
} from '$lib/db/types';

const REPORT_TITLE = 'AMBULATORIO CARDIOLOGICO DELLE DISLIPIDEMIE';
const TEMPLATE_URL = new URL('../templates/template_dislip.docx', import.meta.url).href;
const TEMPLATE_RESOURCE_NAME = 'template_dislip.docx';

type TitoloToken = TitoloFirmaMedico | '';

type ReportPlaceholderPair = {
  header: string;
  value: string;
};

type ReportSpecializzando = {
  nome: string;
  titolo: TitoloToken;
};

type ReportFormData = {
  data_visita: string;
  tipo_visita: string;
  motivo: string;
  altezza: string;
  peso: string;
  bmi: string;
};

type ReportFattoriRischio = {
  familiarita: boolean;
  familiarita_note: string;
  ipertensione: boolean;
  diabete: boolean;
  diabete_durata: string;
  diabete_tipo: '' | '1' | '2';
  dislipidemia: boolean;
  obesita: boolean;
  fumo: string;
  fumo_ex_eta: string;
};

export type GenerateVisitaRefertoInput = {
  paziente: Paziente;
  formData: ReportFormData;
  fattoriRischio: ReportFattoriRischio;
  anamnesiPatologicaRemota: string;
  terapiaIpolipemizzante: TerapiaIpolipemizzante;
  terapiaDomiciliare: string;
  esamiEmatici: EsamiEmaticiValues;
  valutazioneRischioCV: ValutazioneRischioCardiovascolare;
  conclusioni: string;
  pianificazioneFollowUp: PianificazioneFollowUp;
  firmeVisita: FirmeVisita;
  visitaId?: number;
};

export type GenerateVisitaRefertoResult = {
  saved: boolean;
  path?: string;
};

const esamiTemplateOrder: Array<{
  key: keyof EsamiEmaticiValues;
  label: string;
  unit: string;
}> = [
  { key: 'hb', label: 'Hb', unit: 'g/dL' },
  { key: 'plt', label: 'PLT', unit: '10^3/uL' },
  { key: 'creatinina', label: 'Creatinina', unit: 'mg/dL' },
  { key: 'egfr', label: 'eGFR', unit: 'mL/min' },
  { key: 'colesterolo_totale', label: 'Colesterolo totale', unit: 'mg/dL' },
  { key: 'hdl', label: 'HDL', unit: 'mg/dL' },
  { key: 'trigliceridi', label: 'Trigliceridi', unit: 'mg/dL' },
  { key: 'ldl_calcolato', label: 'LDL calcolato', unit: 'mg/dL' },
  { key: 'ldl_diretto', label: 'LDL diretto', unit: 'mg/dL' },
  { key: 'lipoproteina_a', label: 'Lipoproteina a', unit: 'mg/dL' },
  { key: 'emoglobina_glicata', label: 'Emoglobina glicata (HbA1c)', unit: '%' },
  { key: 'glicemia', label: 'Glicemia', unit: 'mg/dL' },
  { key: 'ast', label: 'AST', unit: 'U/L' },
  { key: 'alt', label: 'ALT', unit: 'U/L' },
  { key: 'bilirubina_totale', label: 'Bilirubina totale', unit: 'mg/dL' },
  { key: 'cpk', label: 'CPK', unit: 'U/L' }
];

function keepPlaceholder(tag: string): string {
  return `{${tag}}`;
}

function cleanupMarkdown(value: string): string {
  return value
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDate(value: string): string {
  if (!value) {
    return '';
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(parsed);
  }

  return value;
}

function formatDateTime(value: string): string {
  if (!value) {
    return '';
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?$/
  );
  if (match) {
    const baseDate = `${match[3]}/${match[2]}/${match[1]}`;
    if (match[4] && match[5]) {
      return `${baseDate} ${match[4]}:${match[5]}`;
    }
    return baseDate;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(parsed);
  }

  return value;
}

function formatDoctorTitle(value: TitoloToken): string {
  if (value === 'dott.ssa') {
    return 'Dott.ssa';
  }

  if (value === 'dott') {
    return 'Dott.';
  }

  return '';
}

function sanitizeFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildConditionalPair(
  headerKey: string,
  valueKey: string,
  headerLabel: string,
  content: string
): ReportPlaceholderPair {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return {
      header: keepPlaceholder(headerKey),
      value: keepPlaceholder(valueKey)
    };
  }

  return {
    header: headerLabel,
    value: normalizedContent
  };
}

function buildFattoriRischioList(
  fattoriRischio: ReportFattoriRischio,
  bmiValue: string
): string {
  const items: string[] = [];

  if (fattoriRischio.familiarita) {
    const note = fattoriRischio.familiarita_note.trim();
    items.push(note ? `Familiarità (${note})` : 'Familiarità');
  }

  if (fattoriRischio.ipertensione) {
    items.push('Ipertensione arteriosa');
  }

  if (fattoriRischio.diabete) {
    let label = 'Diabete mellito';
    if (fattoriRischio.diabete_tipo) {
      label += ` tipo ${fattoriRischio.diabete_tipo}`;
    }
    if (fattoriRischio.diabete_durata.trim()) {
      label += ` (${fattoriRischio.diabete_durata.trim()})`;
    }
    items.push(label);
  }

  if (fattoriRischio.dislipidemia) {
    items.push('Dislipidemia');
  }

  if (fattoriRischio.obesita) {
    const bmi = Number.parseFloat(bmiValue.replace(',', '.'));
    if (Number.isFinite(bmi)) {
      if (bmi < 30) {
        items.push('Sovrappeso');
      } else if (bmi < 35) {
        items.push('Obesità classe I');
      } else if (bmi < 40) {
        items.push('Obesità classe II');
      } else {
        items.push('Obesità classe III');
      }
    } else {
      items.push('Obesità');
    }
  }

  if (fattoriRischio.fumo === 'si') {
    items.push('Fumo attivo');
  } else if (fattoriRischio.fumo === 'ex') {
    const note = fattoriRischio.fumo_ex_eta.trim();
    items.push(note ? `Ex fumatore (fino a ${note})` : 'Ex fumatore');
  }

  return items.join(', ');
}

function buildTerapiaIpolipemizzanteList(terapia: TerapiaIpolipemizzante): string {
  const items: string[] = [];

  if (terapia.statine.enabled && terapia.statine.dose) {
    items.push(`Statina (${terapia.statine.dose})`);
  }

  if (terapia.ezetimibe.enabled) {
    items.push(
      terapia.ezetimibe.modalita
        ? `Ezetimibe (${terapia.ezetimibe.modalita})`
        : 'Ezetimibe'
    );
  }

  if (terapia.fibrati.enabled && terapia.fibrati.dose) {
    items.push(`Fibrati (${terapia.fibrati.dose})`);
  }

  if (terapia.omega3.enabled && terapia.omega3.dose) {
    items.push(`Omega 3 (${terapia.omega3.dose})`);
  }

  if (terapia.acido_bempedoico.enabled && terapia.acido_bempedoico.dose) {
    items.push(`Acido bempedoico (${terapia.acido_bempedoico.dose})`);
  }

  if (terapia.repatha.enabled && terapia.repatha.dose) {
    items.push(`Repatha (${terapia.repatha.dose})`);
  }

  if (terapia.praluent.enabled && terapia.praluent.dose) {
    items.push(`Praluent (${terapia.praluent.dose})`);
  }

  if (terapia.leqvio.enabled && terapia.leqvio.dose) {
    items.push(`Leqvio (${terapia.leqvio.dose})`);
  }

  return items.join(', ');
}

function buildEsamiEmaticiList(esami: EsamiEmaticiValues): string {
  const items = esamiTemplateOrder
    .map((analyte) => {
      const value = String(esami[analyte.key] || '').trim();
      if (!value) {
        return '';
      }

      return `${analyte.label} ${value} ${analyte.unit}`;
    })
    .filter(Boolean);

  return items.length > 0 ? items.join(', ') : 'Non in visione';
}

function buildRischioLabel(rischio: ValutazioneRischioCardiovascolare['rischio']): string {
  const option = rischioCVOptions.find((entry) => entry.value === rischio);
  return option?.label || 'Non definita';
}

function buildTargetLabel(valutazione: ValutazioneRischioCardiovascolare): string {
  if (valutazione.status === 'raggiunto') {
    return 'Colesterolo LDL: a target';
  }

  if (valutazione.status === 'non_raggiunto') {
    return 'Colesterolo LDL: NON a target';
  }

  if (valutazione.targetLdl !== null) {
    return `Target LDL < ${valutazione.targetLdl} mg/dL`;
  }

  return 'Target LDL < xx mg/dL';
}

function buildReportData(input: GenerateVisitaRefertoInput): Record<string, string> {
  const fattoriRischioList = buildFattoriRischioList(input.fattoriRischio, input.formData.bmi);
  const anamnesiPatologicaRemota = cleanupMarkdown(input.anamnesiPatologicaRemota);
  const terapiaIpolipemizzante = buildTerapiaIpolipemizzanteList(input.terapiaIpolipemizzante);
  const terapiaDomiciliare = cleanupMarkdown(input.terapiaDomiciliare);

  const fattoriPair = buildConditionalPair(
    'hfdrcv',
    'fdrcv',
    'Fattori di rischio CV:',
    fattoriRischioList
  );
  const aprPair = buildConditionalPair(
    'hapr',
    'apr',
    'Anamnesi patologica remota:',
    anamnesiPatologicaRemota
  );
  const terapiaIpolipemizzantePair = buildConditionalPair(
    'htpipo',
    'tpipo',
    'Terapia ipolipemizzante:',
    terapiaIpolipemizzante
  );
  const terapiaDomiciliarePair = buildConditionalPair(
    'hresttp',
    'resttp',
    'Restante terapia domiciliare:',
    terapiaDomiciliare
  );

  const cardiologoNome = input.firmeVisita.cardiologoNome.trim();
  const specializzandi: ReportSpecializzando[] = input.firmeVisita.mediciInFormazione
    .map((medico) => ({
      nome: medico.nome.trim(),
      titolo: medico.nome.trim() ? medico.titolo : ''
    }))
    .filter((medico) => medico.nome)
    .slice(0, 3);

  return {
    titolo: REPORT_TITLE,
    data_visita: formatDate(input.formData.data_visita),
    nome: input.paziente.nome,
    cognome: input.paziente.cognome,
    nato_nata:
      input.paziente.sesso === 'F' ? 'Nata' : input.paziente.sesso === 'M' ? 'Nato' : 'Nato/a',
    comune_nascita: input.paziente.luogo_nascita,
    data_nascita: formatDate(input.paziente.data_nascita),
    codice_fiscale: input.paziente.codice_fiscale,
    telefono: input.paziente.telefono?.trim() || '-',
    peso: input.formData.peso.trim() || '-',
    altezza: input.formData.altezza.trim() || '-',
    bmi: input.formData.bmi.trim() || '-',
    tipo_visita: input.formData.tipo_visita,
    motivo_visita: cleanupMarkdown(input.formData.motivo),
    hfdrcv: fattoriPair.header,
    fdrcv: fattoriPair.value,
    hapr: aprPair.header,
    apr: aprPair.value,
    htpipo: terapiaIpolipemizzantePair.header,
    tpipo: terapiaIpolipemizzantePair.value,
    hresttp: terapiaDomiciliarePair.header,
    resttp: terapiaDomiciliarePair.value,
    ee: buildEsamiEmaticiList(input.esamiEmatici),
    rcv: buildRischioLabel(input.valutazioneRischioCV.rischio),
    target: buildTargetLabel(input.valutazioneRischioCV),
    conclusioni: cleanupMarkdown(input.conclusioni),
    proxvisita: input.pianificazioneFollowUp.dataOraProssimaVisita
      ? formatDateTime(input.pianificazioneFollowUp.dataOraProssimaVisita)
      : 'Non programmata',
    proxee: cleanupMarkdown(input.pianificazioneFollowUp.esamiEmaticiDaFare) || 'Non specificati',
    dottssa: cardiologoNome ? formatDoctorTitle(input.firmeVisita.cardiologoTitolo) : '',
    cardiologo: cardiologoNome,
    dottssasp1: formatDoctorTitle(specializzandi[0]?.titolo || ''),
    specializzando1: specializzandi[0]?.nome || '',
    dottssasp2: formatDoctorTitle(specializzandi[1]?.titolo || ''),
    specializzando2: specializzandi[1]?.nome || '',
    dottssasp3: formatDoctorTitle(specializzandi[2]?.titolo || ''),
    specializzando3: specializzandi[2]?.nome || ''
  };
}

function buildSuggestedFileName(input: GenerateVisitaRefertoInput): string {
  const cognome = sanitizeFileName(input.paziente.cognome) || 'paziente';
  const nome = sanitizeFileName(input.paziente.nome) || 'visita';
  const dataVisita = formatDate(input.formData.data_visita).replace(/\//g, '-');
  const visitSuffix = input.visitaId ? `_id-${input.visitaId}` : '';

  return `referto_dislip_${cognome}_${nome}_${dataVisita}${visitSuffix}.docx`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error ? (error as { message?: unknown }).message : undefined;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
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

async function loadTemplateFromAsset(): Promise<ArrayBuffer> {
  const response = await fetch(TEMPLATE_URL);

  if (!response.ok) {
    throw new Error('Template DOCX non trovato');
  }

  return response.arrayBuffer();
}

async function loadTemplateFromResource(): Promise<ArrayBuffer> {
  const resourcePath = await resolveResource(TEMPLATE_RESOURCE_NAME);
  const content = await readFile(resourcePath);
  return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
}

async function loadTemplate(): Promise<ArrayBuffer> {
  try {
    return await loadTemplateFromAsset();
  } catch (assetError) {
    try {
      return await loadTemplateFromResource();
    } catch (resourceError) {
      throw new Error(
        `Template DOCX non disponibile. Asset web: ${getErrorMessage(assetError)}. Risorsa Tauri: ${getErrorMessage(resourceError)}`
      );
    }
  }
}

function renderTemplate(template: ArrayBuffer, data: Record<string, string>): Uint8Array {
  const zip = new PizZip(template);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  });

  doc.render(data);

  return doc.getZip().generate({
    type: 'uint8array'
  });
}

function ensureDocxExtension(filePath: string): string {
  return filePath.toLowerCase().endsWith('.docx') ? filePath : `${filePath}.docx`;
}

async function resolveOutputPath(input: GenerateVisitaRefertoInput): Promise<string | null> {
  const filePath = await save({
    defaultPath: buildSuggestedFileName(input),
    filters: [
      {
        name: 'Documento Word',
        extensions: ['docx']
      }
    ]
  });

  if (!filePath) {
    return null;
  }

  return ensureDocxExtension(filePath);
}

export async function generateVisitaReferto(
  input: GenerateVisitaRefertoInput
): Promise<GenerateVisitaRefertoResult> {
  const template = await loadTemplate();
  const content = renderTemplate(template, buildReportData(input));
  const resolvedPath = await resolveOutputPath(input);

  if (!resolvedPath) {
    return { saved: false };
  }

  await writeFile(resolvedPath, content, { create: true });

  return {
    saved: true,
    path: resolvedPath
  };
}
