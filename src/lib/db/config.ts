export const DEFAULT_DATABASE_URL = 'postgres://gmd:gmd_local@127.0.0.1:5432/gmd_platform';
export const DEFAULT_DATABASE_BOOTSTRAP_URL = 'postgres://postgres@127.0.0.1:5432/postgres';
export const DEFAULT_DATABASE_BOOTSTRAP_FALLBACK_URL = 'postgres://127.0.0.1:5432/postgres';

export const DATABASE_URL =
  (import.meta.env['VITE_DATABASE_URL'] as string | undefined) ?? DEFAULT_DATABASE_URL;

export const DATABASE_BOOTSTRAP_URL =
  (import.meta.env['VITE_DATABASE_BOOTSTRAP_URL'] as string | undefined) ??
  DEFAULT_DATABASE_BOOTSTRAP_URL;
