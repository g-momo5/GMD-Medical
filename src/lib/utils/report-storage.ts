import { documentDir, join } from '@tauri-apps/api/path';

const REPORT_BASE_DIR_STORAGE_KEY = 'gmd_report_base_dir';
const DEFAULT_REPORT_ROOT_FOLDER = 'GMD Medical';
const DEFAULT_REPORT_SUBFOLDER = 'Referti';

function getStoredReportBaseDirectory(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedValue = localStorage.getItem(REPORT_BASE_DIR_STORAGE_KEY)?.trim();
  return storedValue ? storedValue : null;
}

export async function getDefaultReportBaseDirectory(): Promise<string> {
  const documentsPath = await documentDir();
  return join(documentsPath, DEFAULT_REPORT_ROOT_FOLDER, DEFAULT_REPORT_SUBFOLDER);
}

export async function getReportBaseDirectory(): Promise<string> {
  const storedValue = getStoredReportBaseDirectory();
  if (storedValue) {
    return storedValue;
  }

  return getDefaultReportBaseDirectory();
}

export function sanitizeReportFolderName(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || 'Ambulatorio';
}

export async function resolveAmbulatorioReportDirectory(ambulatorioName: string): Promise<string> {
  const baseDirectory = await getReportBaseDirectory();
  return join(baseDirectory, sanitizeReportFolderName(ambulatorioName));
}

export function setReportBaseDirectory(path: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedPath = path.trim();
  if (!normalizedPath) {
    localStorage.removeItem(REPORT_BASE_DIR_STORAGE_KEY);
    return;
  }

  localStorage.setItem(REPORT_BASE_DIR_STORAGE_KEY, normalizedPath);
}

export function clearReportBaseDirectory(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(REPORT_BASE_DIR_STORAGE_KEY);
}
