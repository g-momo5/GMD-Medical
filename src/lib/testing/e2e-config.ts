import type { E2EConfig } from './e2e-types';

const DEFAULT_OUTPUT_DIR = '/tmp/gmd-visit-report-e2e';
const DEFAULT_RUNTIME_OUTPUT_DIR = '/tmp';

function parseBoolean(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function getE2EConfig(searchParams?: URLSearchParams): E2EConfig {
  const envEnabled = parseBoolean(import.meta.env.VITE_E2E_MODE);
  const queryEnabled = searchParams ? parseBoolean(searchParams.get('run')) : false;
  const outputDir =
    searchParams?.get('outputDir')?.trim() ||
    import.meta.env.VITE_E2E_OUTPUT_DIR ||
    DEFAULT_OUTPUT_DIR;
  const runtimeOutputDir =
    searchParams?.get('runtimeOutputDir')?.trim() ||
    import.meta.env.VITE_E2E_RUNTIME_OUTPUT_DIR ||
    DEFAULT_RUNTIME_OUTPUT_DIR;

  return {
    enabled: envEnabled || queryEnabled,
    outputDir,
    runtimeOutputDir,
    fixedReportPath: `${outputDir}/visit-report-referto.docx`,
    suiteReportPath: `${outputDir}/visit-report-result.json`
  };
}
