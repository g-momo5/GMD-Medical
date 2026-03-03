import type {
  E2EAssertionRecord,
  E2ECollector,
  E2EErrorRecord,
  E2EPhase,
  E2EToastRecord
} from './e2e-types';
import type { ToastType } from '$lib/stores/toast';

let activeCollector: E2ECollector | null = null;

function now(): string {
  return new Date().toISOString();
}

export class DefaultE2ECollector implements E2ECollector {
  readonly toasts: E2EToastRecord[] = [];
  readonly errors: E2EErrorRecord[] = [];
  readonly assertions: E2EAssertionRecord[] = [];

  recordToast(type: ToastType, message: string): void {
    this.toasts.push({
      type,
      message,
      timestamp: now()
    });
  }

  recordError(
    source: E2EErrorRecord['source'],
    phase: E2EPhase,
    message: string,
    options?: { fatal?: boolean; stack?: string; details?: string }
  ): void {
    this.errors.push({
      source,
      phase,
      message,
      fatal: options?.fatal ?? false,
      stack: options?.stack,
      details: options?.details,
      timestamp: now()
    });
  }

  recordAssertion(name: string, passed: boolean, details?: string): void {
    this.assertions.push({
      name,
      passed,
      details,
      timestamp: now()
    });
  }
}

export function setActiveE2ECollector(collector: E2ECollector | null): void {
  activeCollector = collector;
}

export function getActiveE2ECollector(): E2ECollector | null {
  return activeCollector;
}
