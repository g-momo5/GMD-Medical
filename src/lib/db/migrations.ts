import type Database from '@tauri-apps/plugin-sql';

type ColumnDefinition = {
  name: string;
  definition: string;
};

const ambulatoriColumns: ColumnDefinition[] = [
  { name: 'indirizzo', definition: 'TEXT' },
  { name: 'telefono', definition: 'TEXT' },
  { name: 'email', definition: 'TEXT' }
];

const pazientiColumns: ColumnDefinition[] = [
  { name: 'telefono', definition: 'TEXT' },
  { name: 'email', definition: 'TEXT' }
];

const visiteColumns: ColumnDefinition[] = [
  { name: 'bsa', definition: 'REAL' },
  { name: 'anamnesi_cardiologica', definition: 'TEXT' },
  { name: 'anamnesi_internistica', definition: 'TEXT' },
  { name: 'terapia_domiciliare', definition: 'TEXT' },
  { name: 'valutazione_odierna', definition: 'TEXT' },
  { name: 'esami_ematici', definition: 'TEXT' },
  { name: 'ecocardiografia', definition: 'TEXT' },
  { name: 'conclusioni', definition: 'TEXT' },
  { name: 'fh_assessment', definition: 'TEXT' },
  { name: 'terapia_ipolipemizzante', definition: 'TEXT' },
  { name: 'valutazione_rischio_cv', definition: 'TEXT' },
  { name: 'firme_visita', definition: 'TEXT' },
  { name: 'pianificazione_followup', definition: 'TEXT' },
  { name: 'anamnesi', definition: 'TEXT' },
  { name: 'esame_obiettivo', definition: 'TEXT' },
  { name: 'diagnosi', definition: 'TEXT' },
  { name: 'terapia', definition: 'TEXT' },
  { name: 'note', definition: 'TEXT' }
];

const fattoriRischioColumns: ColumnDefinition[] = [
  { name: 'diabete_tipo', definition: "TEXT DEFAULT ''" },
  { name: 'fumo_ex_eta', definition: 'TEXT' }
];

const indexStatements = [
  'CREATE INDEX IF NOT EXISTS idx_pazienti_ambulatorio ON pazienti(ambulatorio_id)',
  'CREATE INDEX IF NOT EXISTS idx_pazienti_cognome ON pazienti(cognome)',
  'CREATE INDEX IF NOT EXISTS idx_pazienti_cf ON pazienti(codice_fiscale)',
  'CREATE INDEX IF NOT EXISTS idx_visite_ambulatorio ON visite(ambulatorio_id)',
  'CREATE INDEX IF NOT EXISTS idx_visite_paziente ON visite(paziente_id)',
  'CREATE INDEX IF NOT EXISTS idx_visite_data ON visite(data_visita)',
  'CREATE INDEX IF NOT EXISTS idx_fattori_rischio_visita ON fattori_rischio_cv(visita_id)'
];

async function getTableColumns(db: Database, tableName: string): Promise<Set<string>> {
  const rows = await db.select<Array<{ name: string }>>(`PRAGMA table_info(${tableName})`);
  return new Set(rows.map((row) => row.name));
}

async function addMissingColumns(
  db: Database,
  tableName: string,
  columnsToEnsure: ColumnDefinition[]
): Promise<void> {
  const existingColumns = await getTableColumns(db, tableName);

  for (const column of columnsToEnsure) {
    if (existingColumns.has(column.name)) {
      continue;
    }

    await db.execute(
      `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.definition}`
    );
  }
}

async function createBaseTables(db: Database): Promise<void> {
  await db.execute('PRAGMA foreign_keys = ON');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      nome TEXT NOT NULL,
      cognome TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ambulatori (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      logo_path TEXT,
      color_primary TEXT NOT NULL DEFAULT '#1e3a8a',
      color_secondary TEXT NOT NULL DEFAULT '#3b82f6',
      color_accent TEXT NOT NULL DEFAULT '#22d3ee',
      indirizzo TEXT,
      telefono TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS pazienti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ambulatorio_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      cognome TEXT NOT NULL,
      data_nascita DATE NOT NULL,
      luogo_nascita TEXT NOT NULL,
      codice_fiscale TEXT NOT NULL,
      sesso TEXT NOT NULL,
      esenzioni TEXT,
      indirizzo TEXT,
      citta TEXT,
      cap TEXT,
      provincia TEXT,
      telefono TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ambulatorio_id) REFERENCES ambulatori(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS visite (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ambulatorio_id INTEGER NOT NULL,
      paziente_id INTEGER NOT NULL,
      medico_id INTEGER NOT NULL,
      data_visita DATETIME NOT NULL,
      tipo_visita TEXT NOT NULL,
      motivo TEXT NOT NULL,
      altezza REAL,
      peso REAL,
      bmi REAL,
      bsa REAL,
      anamnesi_cardiologica TEXT,
      anamnesi_internistica TEXT,
      terapia_domiciliare TEXT,
      valutazione_odierna TEXT,
      esami_ematici TEXT,
      ecocardiografia TEXT,
      fh_assessment TEXT,
      terapia_ipolipemizzante TEXT,
      valutazione_rischio_cv TEXT,
      firme_visita TEXT,
      pianificazione_followup TEXT,
      conclusioni TEXT,
      anamnesi TEXT,
      esame_obiettivo TEXT,
      diagnosi TEXT,
      terapia TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ambulatorio_id) REFERENCES ambulatori(id) ON DELETE CASCADE,
      FOREIGN KEY (paziente_id) REFERENCES pazienti(id) ON DELETE CASCADE,
      FOREIGN KEY (medico_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS fattori_rischio_cv (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visita_id INTEGER NOT NULL,
      familiarita BOOLEAN DEFAULT 0,
      familiarita_note TEXT,
      ipertensione BOOLEAN DEFAULT 0,
      diabete BOOLEAN DEFAULT 0,
      diabete_durata TEXT,
      diabete_tipo TEXT DEFAULT '',
      dislipidemia BOOLEAN DEFAULT 0,
      obesita BOOLEAN DEFAULT 0,
      fumo TEXT DEFAULT '',
      fumo_ex_eta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visita_id) REFERENCES visite(id) ON DELETE CASCADE
    )
  `);
}

async function ensureIndexes(db: Database): Promise<void> {
  for (const statement of indexStatements) {
    await db.execute(statement);
  }
}

async function updateLegacyAmbulatorioLabel(db: Database): Promise<void> {
  await db.execute(
    `UPDATE ambulatori
     SET nome = ?, logo_path = ?, color_primary = ?, color_secondary = ?, color_accent = ?, updated_at = CURRENT_TIMESTAMP
     WHERE nome = ?`,
    [
      'Day Hospital Riabilitativa',
      '/ambulatori/icon_dhr.png',
      '#03a19e',
      '#10ccb4',
      '#31e0c6',
      'Dermatologia'
    ]
  );
}

export async function applyMigrations(db: Database): Promise<void> {
  await createBaseTables(db);
  await addMissingColumns(db, 'ambulatori', ambulatoriColumns);
  await addMissingColumns(db, 'pazienti', pazientiColumns);
  await addMissingColumns(db, 'visite', visiteColumns);
  await addMissingColumns(db, 'fattori_rischio_cv', fattoriRischioColumns);
  await ensureIndexes(db);
  await updateLegacyAmbulatorioLabel(db);
}
