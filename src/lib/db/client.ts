import Database from '@tauri-apps/plugin-sql';
import {
  DEFAULT_DATABASE_BOOTSTRAP_FALLBACK_URL,
  DATABASE_BOOTSTRAP_URL,
  DATABASE_URL,
  DEFAULT_DATABASE_BOOTSTRAP_URL,
  DEFAULT_DATABASE_URL
} from './config';

let db: Database | null = null;

function normalizeQueryParam(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return value;
}

function normalizeQueryParams(params?: unknown[]): unknown[] | undefined {
  if (!params) {
    return params;
  }

  return params.map((value) => normalizeQueryParam(value));
}

function wrapDatabase(database: Database): Database {
  return new Proxy(database, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof value !== 'function') {
        return value;
      }

      if (prop === 'select' || prop === 'execute') {
        return (sql: string, params?: unknown[]) =>
          value.call(target, sql, normalizeQueryParams(params));
      }

      return value.bind(target);
    }
  }) as Database;
}

function extractErrorMessage(error: unknown): string {
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

function getDatabaseTarget(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    const databaseName = parsed.pathname.replace(/^\//, '') || 'database';
    const port = parsed.port || '5432';
    return `${parsed.hostname}:${port}/${databaseName}`;
  } catch {
    return '127.0.0.1:5432/gmd_platform';
  }
}

function getCredentiallessDatabaseUrl(connectionString: string, databaseName?: string): string | null {
  try {
    const parsed = new URL(connectionString);
    const derivedDatabaseName = parsed.pathname.replace(/^\//, '');
    const resolvedDatabaseName = databaseName ?? (derivedDatabaseName || 'postgres');

    return `${parsed.protocol}//${parsed.host}/${resolvedDatabaseName}`;
  } catch {
    return null;
  }
}

function getBootstrapCandidates(): string[] {
  const candidates = new Set<string>();

  if (DATABASE_BOOTSTRAP_URL) {
    candidates.add(DATABASE_BOOTSTRAP_URL);
  }

  const derivedCredentiallessBootstrap = getCredentiallessDatabaseUrl(DATABASE_URL, 'postgres');
  if (derivedCredentiallessBootstrap) {
    candidates.add(derivedCredentiallessBootstrap);
  }

  candidates.add(DEFAULT_DATABASE_BOOTSTRAP_FALLBACK_URL);

  return [...candidates];
}

function buildConnectionError(reason: string): Error {
  const target = getDatabaseTarget(DATABASE_URL);
  return new Error(
    `Impossibile connettersi a PostgreSQL (${target}). Verifica che il server sia avviato. Dettaglio: ${reason}`
  );
}

async function ensureDefaultRoleAndDatabase(originalReason: string): Promise<boolean> {
  const isUsingDefaultConnection = DATABASE_URL === DEFAULT_DATABASE_URL;
  const requiresBootstrap =
    originalReason.includes('role "gmd" does not exist') ||
    originalReason.includes('password authentication failed for user "gmd"') ||
    originalReason.includes('database "gmd_platform" does not exist');

  if (!isUsingDefaultConnection || !requiresBootstrap) {
    return false;
  }

  let adminDb: Database | null = null;
  const bootstrapFailures: string[] = [];

  for (const bootstrapUrl of getBootstrapCandidates()) {
    try {
      adminDb = await Database.load(bootstrapUrl);

      const roleRows = await adminDb.select<Array<{ exists: boolean }>>(
        'SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists',
        ['gmd']
      );
      const roleExists = Boolean(roleRows[0]?.exists);

      if (roleExists) {
        await adminDb.execute(`ALTER ROLE gmd WITH LOGIN PASSWORD 'gmd_local'`);
      } else {
        await adminDb.execute(`CREATE ROLE gmd WITH LOGIN PASSWORD 'gmd_local'`);
      }

      const databaseRows = await adminDb.select<Array<{ exists: boolean }>>(
        'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
        ['gmd_platform']
      );
      const databaseExists = Boolean(databaseRows[0]?.exists);

      if (!databaseExists) {
        await adminDb.execute('CREATE DATABASE gmd_platform OWNER gmd');
      }

      return true;
    } catch (bootstrapError) {
      bootstrapFailures.push(
        `${getDatabaseTarget(bootstrapUrl)}: ${extractErrorMessage(bootstrapError)}`
      );
    } finally {
      if (adminDb) {
        try {
          await adminDb.close();
        } catch {
          // ignore close failures on bootstrap connection
        }
        adminDb = null;
      }
    }
  }

  const bootstrapHint =
    DATABASE_BOOTSTRAP_URL === DEFAULT_DATABASE_BOOTSTRAP_URL
      ? 'Configura VITE_DATABASE_BOOTSTRAP_URL con una connessione admin valida oppure crea manualmente ruolo e database.'
      : 'Verifica VITE_DATABASE_BOOTSTRAP_URL oppure crea manualmente ruolo e database.';

  throw buildConnectionError(
    `${originalReason}. Bootstrap automatico fallito su ${bootstrapFailures.join(' | ')}. ${bootstrapHint}`
  );
}

export async function loadDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  try {
    db = wrapDatabase(await Database.load(DATABASE_URL));
    return db;
  } catch (error) {
    const reason = extractErrorMessage(error);

    const bootstrapped = await ensureDefaultRoleAndDatabase(reason);
    if (bootstrapped) {
      try {
        db = wrapDatabase(await Database.load(DATABASE_URL));
        return db;
      } catch (retryError) {
        throw buildConnectionError(extractErrorMessage(retryError));
      }
    }

    throw buildConnectionError(reason);
  }
}

export function getLoadedDatabase(): Database {
  if (!db) {
    throw new Error('Database non inizializzato. Chiamare initDatabase() prima.');
  }

  return db;
}

export async function resetLoadedDatabase(): Promise<void> {
  if (!db) {
    return;
  }

  try {
    await db.close();
  } catch {
    // ignore close failures during reset
  } finally {
    db = null;
  }
}

export async function insertReturningId(sql: string, params: unknown[]): Promise<number> {
  const rows = await getLoadedDatabase().select<Array<{ id: number | string }>>(sql, params);
  const insertedId = rows[0]?.id;
  const normalizedId = typeof insertedId === 'string' ? Number(insertedId) : insertedId;

  if (!Number.isInteger(normalizedId)) {
    throw new Error('Impossibile ottenere l\'ID appena creato dal database.');
  }

  return normalizedId;
}
