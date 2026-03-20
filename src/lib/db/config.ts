import { appConfigDir, join } from '@tauri-apps/api/path';

const SQLITE_URL_PATTERN = /^sqlite:.+/i;

const DATABASE_DIRECTORY_STORAGE_KEY = 'gmd_database_directory';
export const DATABASE_FILENAME = 'gmd.db';

export function assertSqliteDatabaseUrl(url: string): string {
  const normalized = url.trim();
  if (!SQLITE_URL_PATTERN.test(normalized)) {
    throw new Error(`URL database non supportato: ${url}. È consentito solo sqlite:*`);
  }

  return normalized;
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function getConfiguredDatabaseDirectory(): string | null {
  const localStorageRef = getLocalStorage();
  const storedValue = localStorageRef?.getItem(DATABASE_DIRECTORY_STORAGE_KEY)?.trim();
  return storedValue ? storedValue : null;
}

export function setConfiguredDatabaseDirectory(path: string): void {
  const localStorageRef = getLocalStorage();
  if (!localStorageRef) {
    return;
  }

  const normalizedPath = path.trim();
  if (!normalizedPath) {
    localStorageRef.removeItem(DATABASE_DIRECTORY_STORAGE_KEY);
    return;
  }

  localStorageRef.setItem(DATABASE_DIRECTORY_STORAGE_KEY, normalizedPath);
}

export function clearConfiguredDatabaseDirectory(): void {
  const localStorageRef = getLocalStorage();
  if (!localStorageRef) {
    return;
  }

  localStorageRef.removeItem(DATABASE_DIRECTORY_STORAGE_KEY);
}

export async function getDefaultDatabaseDirectory(): Promise<string> {
  return appConfigDir();
}

export async function getRuntimeDatabaseDirectory(): Promise<string> {
  const configuredDirectory = getConfiguredDatabaseDirectory();
  if (configuredDirectory) {
    return configuredDirectory;
  }

  return getDefaultDatabaseDirectory();
}

export async function getDatabasePathForDirectory(directoryPath: string): Promise<string> {
  const normalizedDirectoryPath = directoryPath.trim();
  if (!normalizedDirectoryPath) {
    throw new Error('Percorso cartella database non valido');
  }

  return join(normalizedDirectoryPath, DATABASE_FILENAME);
}

export async function getRuntimeDatabasePath(): Promise<string> {
  const runtimeDirectory = await getRuntimeDatabaseDirectory();
  return getDatabasePathForDirectory(runtimeDirectory);
}

export async function getRuntimeDatabaseUrl(): Promise<string> {
  const runtimePath = await getRuntimeDatabasePath();
  return assertSqliteDatabaseUrl(`sqlite:${runtimePath}`);
}
