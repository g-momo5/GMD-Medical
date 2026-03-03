// GMD Medical Platform - Ambulatori Database Operations
import { insertReturningId } from './client';
import { initDatabase } from './schema';
import type { Ambulatorio } from './types';

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

export async function getAllAmbulatori(): Promise<Ambulatorio[]> {
  const db = await initDatabase();
  return db.select<Ambulatorio[]>(
    'SELECT * FROM ambulatori ORDER BY nome'
  );
}

export async function getAmbulatorioById(id: number): Promise<Ambulatorio | null> {
  const db = await initDatabase();
  const result = await db.select<Ambulatorio[]>(
    'SELECT * FROM ambulatori WHERE id = CAST($1 AS INTEGER)',
    [normalizeIntegerForWrite(id)]
  );
  return result[0] || null;
}

export async function createAmbulatorio(
  nome: string,
  logoPath: string | null,
  colorPrimary: string,
  colorSecondary: string,
  colorAccent: string
): Promise<number> {
  return insertReturningId(
    `INSERT INTO ambulatori (nome, logo_path, color_primary, color_secondary, color_accent)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [nome, logoPath, colorPrimary, colorSecondary, colorAccent]
  );
}

export async function updateAmbulatorio(
  id: number,
  nome?: string,
  logoPath?: string | null,
  colorPrimary?: string,
  colorSecondary?: string,
  colorAccent?: string,
  indirizzo?: string,
  telefono?: string,
  email?: string
): Promise<void> {
  const db = await initDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (nome !== undefined) {
    values.push(nome);
    fields.push(`nome = $${values.length}`);
  }
  if (logoPath !== undefined) {
    values.push(logoPath);
    fields.push(`logo_path = $${values.length}`);
  }
  if (colorPrimary !== undefined) {
    values.push(colorPrimary);
    fields.push(`color_primary = $${values.length}`);
  }
  if (colorSecondary !== undefined) {
    values.push(colorSecondary);
    fields.push(`color_secondary = $${values.length}`);
  }
  if (colorAccent !== undefined) {
    values.push(colorAccent);
    fields.push(`color_accent = $${values.length}`);
  }
  if (indirizzo !== undefined) {
    values.push(indirizzo);
    fields.push(`indirizzo = $${values.length}`);
  }
  if (telefono !== undefined) {
    values.push(telefono);
    fields.push(`telefono = $${values.length}`);
  }
  if (email !== undefined) {
    values.push(email);
    fields.push(`email = $${values.length}`);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(normalizeIntegerForWrite(id));

  await db.execute(
    `UPDATE ambulatori SET ${fields.join(', ')} WHERE id = CAST($${values.length} AS INTEGER)`,
    values
  );
}

export async function deleteAmbulatorio(id: number): Promise<void> {
  const db = await initDatabase();
  await db.execute('DELETE FROM ambulatori WHERE id = CAST($1 AS INTEGER)', [
    normalizeIntegerForWrite(id)
  ]);
}
