// GMD Medical Platform - Visite Database Functions
import { insertReturningId } from './client';
import { initDatabase } from './schema';
import type {
  CreateVisitaInput,
  EsameEmaticoKey,
  PreviousEsamiEmaticiMap,
  UpdateVisitaInput,
  Visita
} from './types';

const esameEmaticoKeys: EsameEmaticoKey[] = [
  'hb',
  'plt',
  'creatinina',
  'egfr',
  'colesterolo_totale',
  'hdl',
  'trigliceridi',
  'ldl_calcolato',
  'ldl_diretto',
  'lipoproteina_a',
  'emoglobina_glicata',
  'glicemia',
  'ast',
  'alt',
  'bilirubina_totale',
  'cpk'
];

function parseEsamiForHistory(raw?: string | null): Record<EsameEmaticoKey, string> {
  const values = Object.fromEntries(esameEmaticoKeys.map((key) => [key, ''])) as Record<
    EsameEmaticoKey,
    string
  >;

  if (!raw) {
    return values;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Record<EsameEmaticoKey, unknown>>;
    for (const key of esameEmaticoKeys) {
      const value = parsed[key];
      values[key] = typeof value === 'string' ? value.trim() : '';
    }
  } catch {
    return values;
  }

  return values;
}

function pushField(fields: string[], values: unknown[], column: string, value: unknown) {
  values.push(value);
  fields.push(`${column} = $${values.length}`);
}

function normalizeIntegerForWrite(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(normalized)) {
    throw new Error(`Valore intero non valido: ${value}`);
  }

  return String(normalized);
}

function pushIntegerField(
  fields: string[],
  values: unknown[],
  column: string,
  value: number | string | null | undefined
) {
  values.push(normalizeIntegerForWrite(value));
  fields.push(`${column} = CAST($${values.length} AS INTEGER)`);
}

function coerceText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function normalizeTextForWrite(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = coerceText(value);
  return normalized === '' ? null : normalized;
}

function normalizeRequiredTextForWrite(value: unknown): string {
  return coerceText(value);
}

function pushTextField(fields: string[], values: unknown[], column: string, value: unknown) {
  values.push(normalizeTextForWrite(value));
  fields.push(`${column} = CAST($${values.length} AS TEXT)`);
}

function pushRequiredTextField(fields: string[], values: unknown[], column: string, value: unknown) {
  values.push(normalizeRequiredTextForWrite(value));
  fields.push(`${column} = CAST($${values.length} AS TEXT)`);
}

function pushTimestampField(fields: string[], values: unknown[], column: string, value: string) {
  values.push(value);
  fields.push(`${column} = CAST($${values.length} AS TIMESTAMP)`);
}

function normalizeRealForWrite(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return String(value);
}

function pushRealField(fields: string[], values: unknown[], column: string, value: number | null) {
  values.push(normalizeRealForWrite(value));
  fields.push(`${column} = CAST($${values.length} AS REAL)`);
}

export async function getAllVisite(): Promise<Visita[]> {
  const db = await initDatabase();
  return db.select<Visita[]>(`
    SELECT
      v.*,
      p.nome as paziente_nome,
      p.cognome as paziente_cognome,
      p.codice_fiscale as paziente_codice_fiscale,
      u.nome as medico_nome,
      u.cognome as medico_cognome
    FROM visite v
    INNER JOIN pazienti p ON v.paziente_id = p.id
    INNER JOIN users u ON v.medico_id = u.id
    ORDER BY v.data_visita DESC, v.created_at DESC
  `);
}

export async function getVisiteByAmbulatorio(ambulatorioId: number): Promise<Visita[]> {
  const db = await initDatabase();
  return db.select<Visita[]>(
    `SELECT
      v.*,
      p.nome as paziente_nome,
      p.cognome as paziente_cognome,
      p.codice_fiscale as paziente_codice_fiscale,
      u.nome as medico_nome,
      u.cognome as medico_cognome
    FROM visite v
    INNER JOIN pazienti p ON v.paziente_id = p.id
    INNER JOIN users u ON v.medico_id = u.id
    WHERE v.ambulatorio_id = CAST($1 AS INTEGER)
    ORDER BY v.data_visita DESC, v.created_at DESC`,
    [normalizeIntegerForWrite(ambulatorioId)]
  );
}

export async function getVisiteByPaziente(pazienteId: number): Promise<Visita[]> {
  const db = await initDatabase();
  return db.select<Visita[]>(
    `SELECT
      v.*,
      p.nome as paziente_nome,
      p.cognome as paziente_cognome,
      p.codice_fiscale as paziente_codice_fiscale,
      u.nome as medico_nome,
      u.cognome as medico_cognome
    FROM visite v
    INNER JOIN pazienti p ON v.paziente_id = p.id
    INNER JOIN users u ON v.medico_id = u.id
    WHERE v.paziente_id = CAST($1 AS INTEGER)
    ORDER BY v.data_visita DESC, v.created_at DESC`,
    [normalizeIntegerForWrite(pazienteId)]
  );
}

export async function searchVisite(query: string, ambulatorioId?: number): Promise<Visita[]> {
  const db = await initDatabase();
  const searchTerm = `%${query}%`;

  let sql = `
    SELECT
      v.*,
      p.nome as paziente_nome,
      p.cognome as paziente_cognome,
      p.codice_fiscale as paziente_codice_fiscale,
      u.nome as medico_nome,
      u.cognome as medico_cognome
    FROM visite v
    INNER JOIN pazienti p ON v.paziente_id = p.id
    INNER JOIN users u ON v.medico_id = u.id
    WHERE (
      p.nome ILIKE $1 OR
      p.cognome ILIKE $2 OR
      p.codice_fiscale ILIKE $3 OR
      v.motivo ILIKE $4 OR
      v.diagnosi ILIKE $5
    )
  `;

  const params: Array<string | number> = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];

  if (ambulatorioId !== undefined) {
    params.push(normalizeIntegerForWrite(ambulatorioId));
    sql += ` AND v.ambulatorio_id = CAST($${params.length} AS INTEGER)`;
  }

  sql += ' ORDER BY v.data_visita DESC, v.created_at DESC';

  return db.select<Visita[]>(sql, params);
}

export async function getVisitaById(id: number): Promise<Visita | null> {
  const db = await initDatabase();
  const visite = await db.select<Visita[]>(
    `SELECT
      v.*,
      p.nome as paziente_nome,
      p.cognome as paziente_cognome,
      p.codice_fiscale as paziente_codice_fiscale,
      u.nome as medico_nome,
      u.cognome as medico_cognome
    FROM visite v
    INNER JOIN pazienti p ON v.paziente_id = p.id
    INNER JOIN users u ON v.medico_id = u.id
    WHERE v.id = CAST($1 AS INTEGER)`,
    [normalizeIntegerForWrite(id)]
  );
  return visite.length > 0 ? visite[0] : null;
}

export async function getPreviousEsamiEmaticiByPaziente(params: {
  pazienteId: number;
  beforeDate: string;
  excludeVisitaId?: number;
}): Promise<PreviousEsamiEmaticiMap> {
  const db = await initDatabase();
  const queryParams: Array<string> = [normalizeIntegerForWrite(params.pazienteId) ?? ''];
  let sql = `
    SELECT id, data_visita, esami_ematici
    FROM visite
    WHERE paziente_id = CAST($1 AS INTEGER)
      AND esami_ematici IS NOT NULL
      AND TRIM(esami_ematici) <> ''
  `;

  if (params.excludeVisitaId !== undefined) {
    queryParams.push(normalizeIntegerForWrite(params.excludeVisitaId) ?? '');
    sql += ` AND id != CAST($${queryParams.length} AS INTEGER)`;
  }

  if (params.beforeDate) {
    queryParams.push(params.beforeDate);
    const operator = params.excludeVisitaId !== undefined ? '<=' : '<';
    sql += ` AND data_visita ${operator} CAST($${queryParams.length} AS TIMESTAMP)`;
  }

  sql += ' ORDER BY data_visita DESC, id DESC';

  const rows = await db.select<Array<{ id: number; data_visita: string; esami_ematici: string | null }>>(
    sql,
    queryParams
  );

  const result: PreviousEsamiEmaticiMap = {};
  const remainingKeys = new Set(esameEmaticoKeys);

  for (const row of rows) {
    const parsed = parseEsamiForHistory(row.esami_ematici);

    for (const key of esameEmaticoKeys) {
      if (!remainingKeys.has(key)) {
        continue;
      }

      const value = parsed[key];
      if (!value) {
        continue;
      }

      result[key] = {
        value,
        date: row.data_visita
      };
      remainingKeys.delete(key);
    }

    if (remainingKeys.size === 0) {
      break;
    }
  }

  return result;
}

export async function createVisita(input: CreateVisitaInput): Promise<number> {
  await initDatabase();

  return insertReturningId(
    `INSERT INTO visite (
      ambulatorio_id, paziente_id, medico_id, data_visita, tipo_visita,
      motivo, altezza, peso, bmi, bsa, anamnesi_cardiologica, anamnesi_internistica, terapia_domiciliare, valutazione_odierna, esami_ematici, ecocardiografia, fh_assessment, terapia_ipolipemizzante, valutazione_rischio_cv, firme_visita, pianificazione_followup, conclusioni, anamnesi, esame_obiettivo, diagnosi, terapia, note
    ) VALUES (
      CAST($1 AS INTEGER), CAST($2 AS INTEGER), CAST($3 AS INTEGER), CAST($4 AS TIMESTAMP), CAST($5 AS TEXT), CAST($6 AS TEXT), CAST($7 AS REAL), CAST($8 AS REAL), CAST($9 AS REAL), CAST($10 AS REAL), CAST($11 AS TEXT), CAST($12 AS TEXT), CAST($13 AS TEXT), CAST($14 AS TEXT), CAST($15 AS TEXT), CAST($16 AS TEXT), CAST($17 AS TEXT), CAST($18 AS TEXT),
      CAST($19 AS TEXT), CAST($20 AS TEXT), CAST($21 AS TEXT), CAST($22 AS TEXT), CAST($23 AS TEXT), CAST($24 AS TEXT), CAST($25 AS TEXT), CAST($26 AS TEXT), CAST($27 AS TEXT)
    )
    RETURNING id`,
    [
      normalizeIntegerForWrite(input.ambulatorio_id),
      normalizeIntegerForWrite(input.paziente_id),
      normalizeIntegerForWrite(input.medico_id),
      input.data_visita,
      normalizeRequiredTextForWrite(input.tipo_visita),
      normalizeRequiredTextForWrite(input.motivo),
      normalizeRealForWrite(input.altezza),
      normalizeRealForWrite(input.peso),
      normalizeRealForWrite(input.bmi),
      normalizeRealForWrite(input.bsa),
      normalizeTextForWrite(input.anamnesi_cardiologica),
      normalizeTextForWrite(input.anamnesi_internistica),
      normalizeTextForWrite(input.terapia_domiciliare),
      normalizeTextForWrite(input.valutazione_odierna),
      normalizeTextForWrite(input.esami_ematici),
      normalizeTextForWrite(input.ecocardiografia),
      normalizeTextForWrite(input.fh_assessment),
      normalizeTextForWrite(input.terapia_ipolipemizzante),
      normalizeTextForWrite(input.valutazione_rischio_cv),
      normalizeTextForWrite(input.firme_visita),
      normalizeTextForWrite(input.pianificazione_followup),
      normalizeTextForWrite(input.conclusioni),
      normalizeTextForWrite(input.anamnesi),
      normalizeTextForWrite(input.esame_obiettivo),
      normalizeTextForWrite(input.diagnosi),
      normalizeTextForWrite(input.terapia),
      normalizeTextForWrite(input.note)
    ]
  );
}

export async function updateVisita(input: UpdateVisitaInput): Promise<void> {
  const db = await initDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.paziente_id !== undefined) {
    pushIntegerField(fields, values, 'paziente_id', input.paziente_id);
  }
  if (input.medico_id !== undefined) {
    pushIntegerField(fields, values, 'medico_id', input.medico_id);
  }
  if (input.data_visita !== undefined) {
    pushTimestampField(fields, values, 'data_visita', input.data_visita);
  }
  if (input.tipo_visita !== undefined) {
    pushRequiredTextField(fields, values, 'tipo_visita', input.tipo_visita);
  }
  if (input.motivo !== undefined) {
    pushRequiredTextField(fields, values, 'motivo', input.motivo);
  }
  if (input.altezza !== undefined) {
    pushRealField(fields, values, 'altezza', input.altezza ?? null);
  }
  if (input.peso !== undefined) {
    pushRealField(fields, values, 'peso', input.peso ?? null);
  }
  if (input.bmi !== undefined) {
    pushRealField(fields, values, 'bmi', input.bmi ?? null);
  }
  if (input.bsa !== undefined) {
    pushRealField(fields, values, 'bsa', input.bsa ?? null);
  }
  if (input.anamnesi_cardiologica !== undefined) {
    pushTextField(fields, values, 'anamnesi_cardiologica', input.anamnesi_cardiologica);
  }
  if (input.anamnesi_internistica !== undefined) {
    pushTextField(fields, values, 'anamnesi_internistica', input.anamnesi_internistica);
  }
  if (input.terapia_domiciliare !== undefined) {
    pushTextField(fields, values, 'terapia_domiciliare', input.terapia_domiciliare);
  }
  if (input.valutazione_odierna !== undefined) {
    pushTextField(fields, values, 'valutazione_odierna', input.valutazione_odierna);
  }
  if (input.esami_ematici !== undefined) {
    pushTextField(fields, values, 'esami_ematici', input.esami_ematici);
  }
  if (input.ecocardiografia !== undefined) {
    pushTextField(fields, values, 'ecocardiografia', input.ecocardiografia);
  }
  if (input.fh_assessment !== undefined) {
    pushTextField(fields, values, 'fh_assessment', input.fh_assessment);
  }
  if (input.terapia_ipolipemizzante !== undefined) {
    pushTextField(fields, values, 'terapia_ipolipemizzante', input.terapia_ipolipemizzante);
  }
  if (input.valutazione_rischio_cv !== undefined) {
    pushTextField(fields, values, 'valutazione_rischio_cv', input.valutazione_rischio_cv);
  }
  if (input.firme_visita !== undefined) {
    pushTextField(fields, values, 'firme_visita', input.firme_visita);
  }
  if (input.pianificazione_followup !== undefined) {
    pushTextField(fields, values, 'pianificazione_followup', input.pianificazione_followup);
  }
  if (input.conclusioni !== undefined) {
    pushTextField(fields, values, 'conclusioni', input.conclusioni);
  }
  if (input.anamnesi !== undefined) {
    pushTextField(fields, values, 'anamnesi', input.anamnesi);
  }
  if (input.esame_obiettivo !== undefined) {
    pushTextField(fields, values, 'esame_obiettivo', input.esame_obiettivo);
  }
  if (input.diagnosi !== undefined) {
    pushTextField(fields, values, 'diagnosi', input.diagnosi);
  }
  if (input.terapia !== undefined) {
    pushTextField(fields, values, 'terapia', input.terapia);
  }
  if (input.note !== undefined) {
    pushTextField(fields, values, 'note', input.note);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(normalizeIntegerForWrite(input.id));

  await db.execute(
    `UPDATE visite SET ${fields.join(', ')} WHERE id = CAST($${values.length} AS INTEGER)`,
    values
  );
}

export async function deleteVisita(id: number): Promise<void> {
  const db = await initDatabase();
  await db.execute('DELETE FROM visite WHERE id = CAST($1 AS INTEGER)', [normalizeIntegerForWrite(id)]);
}
