// GMD Medical Platform - Authentication
import bcrypt from 'bcryptjs';
import { insertReturningId } from './client';
import { initDatabase } from './schema';
import type { User } from './types';

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

export async function authenticateUser(
  username: string,
  password: string
): Promise<User | null> {
  try {
    console.log('authenticateUser - Inizio con username:', username);
    const db = await initDatabase();
    console.log('Database ottenuto');

    const result = await db.select<User[]>(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    console.log('Query eseguita, risultati trovati:', result.length);

    if (result.length === 0) {
      console.log('Nessun utente trovato con questo username');
      return null;
    }

    const user = result[0];
    console.log('Utente trovato:', user.username, 'Role:', user.role);
    console.log('Password hash dal DB:', user.password_hash);

    console.log('Verifica password con bcrypt...');
    const isValid = await bcrypt.compare(password, user.password_hash);
    console.log('Password valida?', isValid);

    if (!isValid) {
      console.log('Password non corretta');
      return null;
    }

    console.log('Autenticazione riuscita!');
    return user;
  } catch (error) {
    console.error('Errore in authenticateUser:', error);
    throw error;
  }
}

export async function createUser(
  username: string,
  password: string,
  role: 'admin' | 'medico' | 'infermiere',
  nome: string,
  cognome: string
): Promise<number> {
  const passwordHash = await bcrypt.hash(password, 10);

  return insertReturningId(
    `INSERT INTO users (username, password_hash, role, nome, cognome)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [username, passwordHash, role, nome, cognome]
  );
}

export async function getAllUsers(): Promise<User[]> {
  const db = await initDatabase();
  return db.select<User[]>(
    'SELECT * FROM users ORDER BY cognome, nome'
  );
}

export async function updateUser(
  userId: number,
  username?: string,
  role?: 'admin' | 'medico' | 'infermiere',
  nome?: string,
  cognome?: string
): Promise<void> {
  const db = await initDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (username !== undefined) {
    values.push(username);
    fields.push(`username = $${values.length}`);
  }
  if (role !== undefined) {
    values.push(role);
    fields.push(`role = $${values.length}`);
  }
  if (nome !== undefined) {
    values.push(nome);
    fields.push(`nome = $${values.length}`);
  }
  if (cognome !== undefined) {
    values.push(cognome);
    fields.push(`cognome = $${values.length}`);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(normalizeIntegerForWrite(userId));

  await db.execute(
    `UPDATE users SET ${fields.join(', ')} WHERE id = CAST($${values.length} AS INTEGER)`,
    values
  );
}

export async function verifyUserPassword(userId: number, password: string): Promise<boolean> {
  const db = await initDatabase();
  const result = await db.select<Array<{ password_hash: string }>>(
    'SELECT password_hash FROM users WHERE id = CAST($1 AS INTEGER)',
    [normalizeIntegerForWrite(userId)]
  );

  if (result.length === 0) {
    return false;
  }

  return bcrypt.compare(password, result[0].password_hash);
}

export async function updateUserPassword(userId: number, newPassword: string): Promise<void> {
  const db = await initDatabase();
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db.execute(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = CAST($2 AS INTEGER)',
    [passwordHash, normalizeIntegerForWrite(userId)]
  );
}

export async function deleteUser(userId: number): Promise<void> {
  const db = await initDatabase();
  await db.execute('DELETE FROM users WHERE id = CAST($1 AS INTEGER)', [
    normalizeIntegerForWrite(userId)
  ]);
}
