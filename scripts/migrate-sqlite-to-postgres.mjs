import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import initSqlJs from 'sql.js';
import pg from 'pg';

const { Client } = pg;

const DEFAULT_DATABASE_URL = 'postgres://gmd:gmd_local@127.0.0.1:5432/gmd_platform';
const IMPORT_NAME = 'legacy_sqlite_gmd_db';
const DEFAULT_SQLITE_PATHS = [
  path.resolve(process.cwd(), 'gmd.db'),
  path.resolve(
    process.env.HOME || '',
    'Library/Application Support/com.gmdmedical.platform/gmd.db'
  )
];
const SQLITE_PATH = resolveSqlitePath();
const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

const TABLES = [
  {
    name: 'users',
    columns: [
      'id',
      'username',
      'password_hash',
      'role',
      'nome',
      'cognome',
      'created_at',
      'updated_at'
    ]
  },
  {
    name: 'ambulatori',
    columns: [
      'id',
      'nome',
      'logo_path',
      'color_primary',
      'color_secondary',
      'color_accent',
      'indirizzo',
      'telefono',
      'email',
      'created_at',
      'updated_at'
    ]
  },
  {
    name: 'pazienti',
    columns: [
      'id',
      'ambulatorio_id',
      'nome',
      'cognome',
      'data_nascita',
      'luogo_nascita',
      'codice_fiscale',
      'sesso',
      'esenzioni',
      'indirizzo',
      'citta',
      'cap',
      'provincia',
      'telefono',
      'email',
      'created_at',
      'updated_at'
    ]
  },
  {
    name: 'visite',
    columns: [
      'id',
      'ambulatorio_id',
      'paziente_id',
      'medico_id',
      'data_visita',
      'tipo_visita',
      'motivo',
      'altezza',
      'peso',
      'bmi',
      'bsa',
      'anamnesi_cardiologica',
      'anamnesi_internistica',
      'terapia_domiciliare',
      'valutazione_odierna',
      'esami_ematici',
      'ecocardiografia',
      'fh_assessment',
      'terapia_ipolipemizzante',
      'valutazione_rischio_cv',
      'firme_visita',
      'pianificazione_followup',
      'conclusioni',
      'anamnesi',
      'esame_obiettivo',
      'diagnosi',
      'terapia',
      'note',
      'created_at',
      'updated_at'
    ]
  },
  {
    name: 'fattori_rischio_cv',
    columns: [
      'id',
      'visita_id',
      'familiarita',
      'familiarita_note',
      'ipertensione',
      'diabete',
      'diabete_durata',
      'diabete_tipo',
      'dislipidemia',
      'obesita',
      'fumo',
      'fumo_ex_eta',
      'created_at',
      'updated_at'
    ],
    booleanColumns: ['familiarita', 'ipertensione', 'diabete', 'dislipidemia', 'obesita']
  }
];

function resolveSqlitePath() {
  if (process.env.SQLITE_PATH) {
    return path.resolve(process.cwd(), process.env.SQLITE_PATH);
  }

  const existingPath = DEFAULT_SQLITE_PATHS.find((candidatePath) => fs.existsSync(candidatePath));
  return existingPath || DEFAULT_SQLITE_PATHS[0];
}

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File SQLite non trovato: ${filePath}`);
  }
}

function createBackup(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.bak.${timestamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function readSqliteTable(sqliteDb, tableName) {
  const result = sqliteDb.exec(`SELECT * FROM ${tableName} ORDER BY id ASC`);
  if (result.length === 0) {
    return [];
  }

  const [{ columns, values }] = result;
  return values.map((valueRow) =>
    Object.fromEntries(columns.map((column, index) => [column, valueRow[index]]))
  );
}

function normalizeBoolean(value) {
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

function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.replace('T', ' ').replace(/Z$/, '');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)) {
    return `${normalized}:00`;
  }

  return normalized;
}

function normalizeValue(table, column, row) {
  if (!(column in row)) {
    if (column === 'created_at' || column === 'updated_at') {
      return new Date().toISOString();
    }

    if (table.booleanColumns?.includes(column)) {
      return false;
    }

    if (column === 'diabete_tipo' || column === 'fumo') {
      return '';
    }

    return null;
  }

  let value = row[column];

  if (table.booleanColumns?.includes(column)) {
    return normalizeBoolean(value);
  }

  if (column === 'data_visita' || column === 'created_at' || column === 'updated_at') {
    return normalizeTimestamp(value);
  }

  if (column === 'data_nascita') {
    return value || null;
  }

  if (column === 'diabete_tipo' || column === 'fumo') {
    return value || '';
  }

  return value ?? null;
}

async function truncateTarget(client) {
  await client.query(
    'TRUNCATE TABLE fattori_rischio_cv, visite, pazienti, ambulatori, users RESTART IDENTITY CASCADE'
  );
}

async function resetSequence(client, tableName, maxId) {
  const normalizedMaxId = maxId > 0 ? maxId : 1;
  const hasRows = maxId > 0;
  await client.query(
    `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), $1, $2)`,
    [normalizedMaxId, hasRows]
  );
}

async function insertRows(client, table, rows) {
  if (rows.length === 0) {
    await resetSequence(client, table.name, 0);
    return { count: 0, maxId: 0 };
  }

  const placeholders = table.columns.map((_, index) => `$${index + 1}`).join(', ');
  const sql = `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${placeholders})`;

  let maxId = 0;
  for (const row of rows) {
    const values = table.columns.map((column) => normalizeValue(table, column, row));
    await client.query(sql, values);
    maxId = Math.max(maxId, Number(row.id || 0));
  }

  await resetSequence(client, table.name, maxId);
  return { count: rows.length, maxId };
}

async function validateCount(client, tableName, expectedCount) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${tableName}`);
  const actualCount = Number(result.rows[0]?.count || 0);
  if (actualCount !== expectedCount) {
    throw new Error(
      `Conteggio non coerente per ${tableName}: SQLite=${expectedCount}, PostgreSQL=${actualCount}`
    );
  }
}

async function markLegacyImportCompleted(client, summary) {
  await client.query(
    `INSERT INTO data_imports (name, details)
     VALUES ($1, $2)
     ON CONFLICT (name)
     DO UPDATE SET imported_at = NOW(), details = EXCLUDED.details`,
    [IMPORT_NAME, JSON.stringify(summary)]
  );
}

async function main() {
  assertFileExists(SQLITE_PATH);
  const backupPath = createBackup(SQLITE_PATH);

  const SQL = await initSqlJs();
  const sqliteDb = new SQL.Database(fs.readFileSync(SQLITE_PATH));
  const client = new Client({ connectionString: DATABASE_URL });

  await client.connect();

  const summary = [];

  try {
    await client.query('BEGIN');
    await truncateTarget(client);

    for (const table of TABLES) {
      const rows = readSqliteTable(sqliteDb, table.name);
      const report = await insertRows(client, table, rows);
      await validateCount(client, table.name, rows.length);
      summary.push({ table: table.name, ...report });
    }

    await markLegacyImportCompleted(client, summary);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    sqliteDb.close();
    await client.end();
  }

  console.log(`Backup SQLite creato: ${backupPath}`);
  for (const item of summary) {
    console.log(`${item.table}: ${item.count} record migrati (max id: ${item.maxId})`);
  }
  console.log('Migrazione completata con successo.');
}

main().catch((error) => {
  console.error('Errore durante la migrazione SQLite -> PostgreSQL:');
  console.error(error);
  process.exitCode = 1;
});
