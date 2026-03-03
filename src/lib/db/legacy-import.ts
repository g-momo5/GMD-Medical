import Database from '@tauri-apps/plugin-sql';

const IMPORT_NAME = 'legacy_sqlite_gmd_db';
const LEGACY_SQLITE_PATH = 'sqlite:gmd.db';

const DEMO_AMBULATORI = new Set([
  'Ambulatorio Cardiologico delle Dislipidemie',
  'Ortopedia',
  'Day Hospital Riabilitativa'
]);

const DEMO_PAZIENTI_CF = new Set([
  'RSSMRA80E15H501Z',
  'BNCGLI92M62F205X'
]);

type TableConfig = {
  name: 'users' | 'ambulatori' | 'pazienti' | 'visite' | 'fattori_rischio_cv';
  columns: string[];
  booleanColumns?: string[];
};

const TABLES: TableConfig[] = [
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

function normalizeBoolean(value: unknown): boolean {
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

function getUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;

    for (const key of ['message', 'detail', 'reason']) {
      const value = errorRecord[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    try {
      const serialized = JSON.stringify(errorRecord);
      if (serialized && serialized !== '{}') {
        return serialized;
      }
    } catch {
      // ignore serialization failures
    }
  }

  return 'errore sconosciuto';
}

function normalizeTimestamp(value: unknown): string | unknown {
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

function normalizeValue(
  table: TableConfig,
  column: string,
  row: Record<string, unknown>
): unknown {
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

  const value = row[column];

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

async function getCount(db: Database, tableName: string): Promise<number> {
  const rows = await db.select<Array<{ count: number | string }>>(
    `SELECT COUNT(*) AS count FROM ${tableName}`
  );
  return Number(rows[0]?.count ?? 0);
}

async function hasImportMarker(db: Database): Promise<boolean> {
  const rows = await db.select<Array<{ count: number | string }>>(
    'SELECT COUNT(*) AS count FROM data_imports WHERE name = $1',
    [IMPORT_NAME]
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function isSafeToReplaceCurrentData(db: Database): Promise<boolean> {
  const counts = await db.select<
    Array<{
      users_count: number | string;
      ambulatori_count: number | string;
      pazienti_count: number | string;
      visite_count: number | string;
      fattori_count: number | string;
    }>
  >(
    `SELECT
      (SELECT COUNT(*) FROM users) AS users_count,
      (SELECT COUNT(*) FROM ambulatori) AS ambulatori_count,
      (SELECT COUNT(*) FROM pazienti) AS pazienti_count,
      (SELECT COUNT(*) FROM visite) AS visite_count,
      (SELECT COUNT(*) FROM fattori_rischio_cv) AS fattori_count`
  );

  const snapshot = counts[0];
  const visiteCount = Number(snapshot?.visite_count ?? 0);
  const fattoriCount = Number(snapshot?.fattori_count ?? 0);

  if (visiteCount > 0 || fattoriCount > 0) {
    return false;
  }

  const users = await db.select<Array<{ username: string; role: string; nome: string; cognome: string }>>(
    'SELECT username, role, nome, cognome FROM users'
  );

  const hasOnlyDemoUsers = users.every(
    (user) =>
      user.username === 'admin' &&
      user.role === 'admin' &&
      user.nome === 'Admin' &&
      user.cognome === 'GMD'
  );

  if (!hasOnlyDemoUsers) {
    return false;
  }

  const ambulatori = await db.select<Array<{ nome: string }>>('SELECT nome FROM ambulatori');
  const hasOnlyDemoAmbulatori = ambulatori.every((ambulatorio) => DEMO_AMBULATORI.has(ambulatorio.nome));

  if (!hasOnlyDemoAmbulatori) {
    return false;
  }

  const pazienti = await db.select<Array<{ codice_fiscale: string }>>(
    'SELECT codice_fiscale FROM pazienti'
  );
  const hasOnlyDemoPazienti = pazienti.every((paziente) =>
    DEMO_PAZIENTI_CF.has(paziente.codice_fiscale)
  );

  return hasOnlyDemoPazienti;
}

async function tryLoadLegacyDatabase(): Promise<Database | null> {
  let legacyDb: Database | null = null;

  try {
    legacyDb = await Database.load(LEGACY_SQLITE_PATH);
    const rows = await legacyDb.select<Array<{ count: number | string }>>(
      `SELECT COUNT(*) AS count
       FROM sqlite_master
       WHERE type = 'table' AND name = $1`,
      ['users']
    );

    if (Number(rows[0]?.count ?? 0) === 0) {
      await legacyDb.close(legacyDb.path);
      return null;
    }

    return legacyDb;
  } catch {
    if (legacyDb) {
      try {
        await legacyDb.close(legacyDb.path);
      } catch {
        // ignore close failures on legacy db
      }
    }
    return null;
  }
}

async function readLegacyRows(
  legacyDb: Database,
  table: TableConfig
): Promise<Array<Record<string, unknown>>> {
  return legacyDb.select<Array<Record<string, unknown>>>(
    `SELECT * FROM ${table.name} ORDER BY id ASC`
  );
}

async function resetSequence(db: Database, tableName: string, maxId: number): Promise<void> {
  const normalizedMaxId = maxId > 0 ? maxId : 1;
  const hasRows = maxId > 0;

  await db.select(
    `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), $1, $2)`,
    [normalizedMaxId, hasRows]
  );
}

async function insertRows(
  postgresDb: Database,
  table: TableConfig,
  rows: Array<Record<string, unknown>>
): Promise<{ count: number; maxId: number }> {
  if (rows.length === 0) {
    await resetSequence(postgresDb, table.name, 0);
    return { count: 0, maxId: 0 };
  }

  const placeholders = table.columns.map((_, index) => `$${index + 1}`).join(', ');
  const sql = `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${placeholders})`;

  let maxId = 0;

  for (const row of rows) {
    const values = table.columns.map((column) => normalizeValue(table, column, row));
    await postgresDb.execute(sql, values);
    maxId = Math.max(maxId, Number(row.id || 0));
  }

  await resetSequence(postgresDb, table.name, maxId);
  return { count: rows.length, maxId };
}

async function truncateAllTables(postgresDb: Database): Promise<void> {
  await postgresDb.execute(
    'TRUNCATE TABLE fattori_rischio_cv, visite, pazienti, ambulatori, users RESTART IDENTITY CASCADE'
  );
}

export async function importLegacySqliteDataIfNeeded(postgresDb: Database): Promise<boolean> {
  if (await hasImportMarker(postgresDb)) {
    return false;
  }

  if (!(await isSafeToReplaceCurrentData(postgresDb))) {
    return false;
  }

  const legacyDb = await tryLoadLegacyDatabase();
  if (!legacyDb) {
    return false;
  }

  try {
    const legacyUsersCount = await getCount(legacyDb, 'users');
    if (legacyUsersCount === 0) {
      return false;
    }

    const legacyData = new Map<TableConfig['name'], Array<Record<string, unknown>>>();

    for (const table of TABLES) {
      legacyData.set(table.name, await readLegacyRows(legacyDb, table));
    }

    const summary: Array<{ table: string; count: number; maxId: number }> = [];

    try {
      await truncateAllTables(postgresDb);

      for (const table of TABLES) {
        const rows = legacyData.get(table.name) ?? [];
        const report = await insertRows(postgresDb, table, rows);
        summary.push({ table: table.name, ...report });
      }

      await postgresDb.execute(
        `INSERT INTO data_imports (name, details)
         VALUES ($1, $2)
         ON CONFLICT (name)
         DO UPDATE SET imported_at = NOW(), details = EXCLUDED.details`,
        [IMPORT_NAME, JSON.stringify(summary)]
      );
      return true;
    } catch (error) {
      await truncateAllTables(postgresDb).catch(() => {});
      throw new Error(
        `Import automatico dal vecchio database SQLite fallito: ${getUnknownErrorMessage(error)}`
      );
    }
  } finally {
    await legacyDb.close(legacyDb.path).catch(() => {});
  }
}
