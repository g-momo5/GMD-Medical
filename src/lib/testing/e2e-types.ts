import type { ToastType } from '$lib/stores/toast';

export type E2EPhase = 'bootstrap' | 'validation' | 'db' | 'report' | 'filesystem' | 'runtime';
export type E2EOutcome = 'save-success' | 'save-fail' | 'report-success' | 'report-fail';

export interface E2EToastRecord {
  type: ToastType;
  message: string;
  timestamp: string;
}

export interface E2EErrorRecord {
  source: 'validation' | 'toast' | 'db' | 'report' | 'runtime' | 'console' | 'audit';
  message: string;
  phase: E2EPhase;
  fatal: boolean;
  stack?: string;
  details?: string;
  timestamp: string;
}

export interface E2EAssertionRecord {
  name: string;
  passed: boolean;
  details?: string;
  timestamp: string;
}

export interface VisitE2ETestCaseResult {
  id: string;
  name: string;
  phase: 'preflight' | 'smoke' | 'field-sweep' | 'runtime-smoke' | 'runtime-field-sweep';
  section: string;
  field: string;
  variant: string;
  status: 'passed' | 'failed';
  expectedOutcome: E2EOutcome;
  actualOutcome: E2EOutcome;
  errors: E2EErrorRecord[];
  toasts: E2EToastRecord[];
  assertions: E2EAssertionRecord[];
  createdVisitId?: number;
  reportPath?: string;
  startedAt: string;
  finishedAt: string;
}

export interface VisitReportE2ESuiteResult {
  status: 'passed' | 'failed';
  startedAt: string;
  finishedAt: string;
  summary: {
    totalCases: number;
    passedCases: number;
    failedCases: number;
    smokePassed: boolean;
  };
  cases: VisitE2ETestCaseResult[];
  globalErrors: E2EErrorRecord[];
  globalToasts: E2EToastRecord[];
}

export interface E2ECollector {
  recordToast(type: ToastType, message: string): void;
  recordError(
    source: E2EErrorRecord['source'],
    phase: E2EPhase,
    message: string,
    options?: { fatal?: boolean; stack?: string; details?: string }
  ): void;
  recordAssertion(name: string, passed: boolean, details?: string): void;
}

export interface E2EConfig {
  enabled: boolean;
  outputDir: string;
  runtimeOutputDir: string;
  fixedReportPath: string;
  suiteReportPath: string;
}
