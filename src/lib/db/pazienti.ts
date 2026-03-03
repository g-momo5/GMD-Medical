// GMD Medical Platform - Pazienti Database Operations
import { insertReturningId } from './client';
import { initDatabase } from './schema';
import type { CreatePazienteInput, Paziente, UpdatePazienteInput } from './types';

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

function pushDateField(fields: string[], values: unknown[], column: string, value: string) {
  values.push(value);
  fields.push(`${column} = CAST($${values.length} AS DATE)`);
}

export async function getAllPazienti(): Promise<Paziente[]> {
  const db = await initDatabase();
  return db.select<Paziente[]>(
    `SELECT * FROM pazienti
     ORDER BY cognome, nome`
  );
}

// Manteniamo questa funzione per compatibilità, ma ora restituisce tutti i pazienti
export async function getPazientiByAmbulatorio(_ambulatorioId: number): Promise<Paziente[]> {
  return getAllPazienti();
}

export async function getPazienteById(id: number): Promise<Paziente | null> {
  const db = await initDatabase();
  const result = await db.select<Paziente[]>(
    'SELECT * FROM pazienti WHERE id = CAST($1 AS INTEGER)',
    [normalizeIntegerForWrite(id)]
  );
  return result[0] || null;
}

export async function searchPazienti(
  _ambulatorioId: number,
  searchTerm: string
): Promise<Paziente[]> {
  const db = await initDatabase();
  const term = `%${searchTerm}%`;
  return db.select<Paziente[]>(
    `SELECT * FROM pazienti
     WHERE (
       nome ILIKE $1 OR
       cognome ILIKE $2 OR
       codice_fiscale ILIKE $3
     )
     ORDER BY cognome, nome`,
    [term, term, term]
  );
}

export async function createPaziente(data: CreatePazienteInput): Promise<number> {
  await initDatabase();

  return insertReturningId(
    `INSERT INTO pazienti (
      ambulatorio_id, nome, cognome, data_nascita, luogo_nascita,
      codice_fiscale, sesso, esenzioni, indirizzo, citta, cap, provincia,
      telefono, email
    ) VALUES (CAST($1 AS INTEGER), $2, $3, CAST($4 AS DATE), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id`,
    [
      normalizeIntegerForWrite(data.ambulatorio_id),
      data.nome,
      data.cognome,
      data.data_nascita,
      data.luogo_nascita,
      data.codice_fiscale,
      data.sesso,
      data.esenzioni || '',
      data.indirizzo || '',
      data.citta || '',
      data.cap || '',
      data.provincia || '',
      data.telefono || '',
      data.email || ''
    ]
  );
}

export async function updatePaziente(data: UpdatePazienteInput): Promise<void> {
  const db = await initDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.nome !== undefined) {
    values.push(data.nome);
    fields.push(`nome = $${values.length}`);
  }
  if (data.cognome !== undefined) {
    values.push(data.cognome);
    fields.push(`cognome = $${values.length}`);
  }
  if (data.data_nascita !== undefined) {
    pushDateField(fields, values, 'data_nascita', data.data_nascita);
  }
  if (data.luogo_nascita !== undefined) {
    values.push(data.luogo_nascita);
    fields.push(`luogo_nascita = $${values.length}`);
  }
  if (data.codice_fiscale !== undefined) {
    values.push(data.codice_fiscale);
    fields.push(`codice_fiscale = $${values.length}`);
  }
  if (data.sesso !== undefined) {
    values.push(data.sesso);
    fields.push(`sesso = $${values.length}`);
  }
  if (data.esenzioni !== undefined) {
    values.push(data.esenzioni);
    fields.push(`esenzioni = $${values.length}`);
  }
  if (data.indirizzo !== undefined) {
    values.push(data.indirizzo);
    fields.push(`indirizzo = $${values.length}`);
  }
  if (data.citta !== undefined) {
    values.push(data.citta);
    fields.push(`citta = $${values.length}`);
  }
  if (data.cap !== undefined) {
    values.push(data.cap);
    fields.push(`cap = $${values.length}`);
  }
  if (data.provincia !== undefined) {
    values.push(data.provincia);
    fields.push(`provincia = $${values.length}`);
  }
  if (data.telefono !== undefined) {
    values.push(data.telefono);
    fields.push(`telefono = $${values.length}`);
  }
  if (data.email !== undefined) {
    values.push(data.email);
    fields.push(`email = $${values.length}`);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(normalizeIntegerForWrite(data.id));

  await db.execute(
    `UPDATE pazienti SET ${fields.join(', ')} WHERE id = CAST($${values.length} AS INTEGER)`,
    values
  );
}

export async function deletePaziente(id: number): Promise<void> {
  const db = await initDatabase();
  await db.execute('DELETE FROM pazienti WHERE id = CAST($1 AS INTEGER)', [
    normalizeIntegerForWrite(id)
  ]);
}
