import { insertReturningId } from './client';
import { initDatabase } from './schema';
import type {
  CreateFattoriRischioCVInput,
  FattoriRischioCV,
  UpdateFattoriRischioCVInput
} from './types';

type Booleanish = boolean | number | string | null | undefined;

function normalizeBoolean(value: Booleanish): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 't';
  }

  return false;
}

function normalizeBooleanForWrite(value: Booleanish): 'true' | 'false' {
  return normalizeBoolean(value) ? 'true' : 'false';
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

function pushBooleanField(fields: string[], values: unknown[], column: string, value: Booleanish) {
  values.push(normalizeBooleanForWrite(value));
  fields.push(`${column} = CAST($${values.length} AS BOOLEAN)`);
}

export async function createFattoriRischioCV(
  data: CreateFattoriRischioCVInput
): Promise<number> {
  await initDatabase();

  return insertReturningId(
    `INSERT INTO fattori_rischio_cv (
      visita_id,
      familiarita,
      familiarita_note,
      ipertensione,
      diabete,
      diabete_durata,
      diabete_tipo,
      dislipidemia,
      obesita,
      fumo,
      fumo_ex_eta
    ) VALUES (
      CAST($1 AS INTEGER),
      CAST($2 AS BOOLEAN),
      CAST($3 AS TEXT),
      CAST($4 AS BOOLEAN),
      CAST($5 AS BOOLEAN),
      CAST($6 AS TEXT),
      CAST($7 AS TEXT),
      CAST($8 AS BOOLEAN),
      CAST($9 AS BOOLEAN),
      CAST($10 AS TEXT),
      CAST($11 AS TEXT)
    )
    RETURNING id`,
    [
      normalizeIntegerForWrite(data.visita_id),
      normalizeBooleanForWrite(data.familiarita),
      normalizeTextForWrite(data.familiarita_note),
      normalizeBooleanForWrite(data.ipertensione),
      normalizeBooleanForWrite(data.diabete),
      normalizeTextForWrite(data.diabete_durata),
      normalizeRequiredTextForWrite(data.diabete_tipo ?? ''),
      normalizeBooleanForWrite(data.dislipidemia),
      normalizeBooleanForWrite(data.obesita),
      normalizeRequiredTextForWrite(data.fumo ?? ''),
      normalizeTextForWrite(data.fumo_ex_eta)
    ]
  );
}

export async function getFattoriRischioCVByVisitaId(
  visitaId: number
): Promise<FattoriRischioCV | null> {
  const db = await initDatabase();

  const rows = await db.select<Array<
    Omit<FattoriRischioCV, 'familiarita' | 'ipertensione' | 'diabete' | 'dislipidemia' | 'obesita'> & {
      familiarita: Booleanish;
      ipertensione: Booleanish;
      diabete: Booleanish;
      dislipidemia: Booleanish;
      obesita: Booleanish;
    }
  >>(
    `SELECT
      id,
      visita_id,
      familiarita,
      familiarita_note,
      ipertensione,
      diabete,
      diabete_durata,
      diabete_tipo,
      dislipidemia,
      obesita,
      fumo,
      fumo_ex_eta,
      created_at,
      updated_at
    FROM fattori_rischio_cv
    WHERE visita_id = CAST($1 AS INTEGER)`,
    [normalizeIntegerForWrite(visitaId)]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    ...row,
    familiarita: normalizeBoolean(row.familiarita),
    ipertensione: normalizeBoolean(row.ipertensione),
    diabete: normalizeBoolean(row.diabete),
    diabete_tipo: row.diabete_tipo || '',
    dislipidemia: normalizeBoolean(row.dislipidemia),
    obesita: normalizeBoolean(row.obesita),
    fumo: row.fumo || ''
  };
}

export async function updateFattoriRischioCV(
  data: UpdateFattoriRischioCVInput
): Promise<void> {
  const db = await initDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.visita_id !== undefined) {
    pushIntegerField(fields, values, 'visita_id', data.visita_id);
  }
  if (data.familiarita !== undefined) {
    pushBooleanField(fields, values, 'familiarita', data.familiarita);
  }
  if (data.familiarita_note !== undefined) {
    pushTextField(fields, values, 'familiarita_note', data.familiarita_note);
  }
  if (data.ipertensione !== undefined) {
    pushBooleanField(fields, values, 'ipertensione', data.ipertensione);
  }
  if (data.diabete !== undefined) {
    pushBooleanField(fields, values, 'diabete', data.diabete);
  }
  if (data.diabete_durata !== undefined) {
    pushTextField(fields, values, 'diabete_durata', data.diabete_durata);
  }
  if (data.diabete_tipo !== undefined) {
    pushRequiredTextField(fields, values, 'diabete_tipo', data.diabete_tipo ?? '');
  }
  if (data.dislipidemia !== undefined) {
    pushBooleanField(fields, values, 'dislipidemia', data.dislipidemia);
  }
  if (data.obesita !== undefined) {
    pushBooleanField(fields, values, 'obesita', data.obesita);
  }
  if (data.fumo !== undefined) {
    pushRequiredTextField(fields, values, 'fumo', data.fumo ?? '');
  }
  if (data.fumo_ex_eta !== undefined) {
    pushTextField(fields, values, 'fumo_ex_eta', data.fumo_ex_eta);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(normalizeIntegerForWrite(data.id));

  await db.execute(
    `UPDATE fattori_rischio_cv
     SET ${fields.join(', ')}
     WHERE id = CAST($${values.length} AS INTEGER)`,
    values
  );
}

export async function deleteFattoriRischioCV(id: number): Promise<void> {
  const db = await initDatabase();
  await db.execute('DELETE FROM fattori_rischio_cv WHERE id = CAST($1 AS INTEGER)', [
    normalizeIntegerForWrite(id)
  ]);
}

export async function deleteFattoriRischioCVByVisitaId(visitaId: number): Promise<void> {
  const db = await initDatabase();
  await db.execute('DELETE FROM fattori_rischio_cv WHERE visita_id = CAST($1 AS INTEGER)', [
    normalizeIntegerForWrite(visitaId)
  ]);
}
