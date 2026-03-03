import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_E2E_DB_URL,
  DEFAULT_OUTPUT_DIR,
  buildSuiteResult,
  maskDatabaseUrl,
  parseCliArgs,
  prepareE2EDatabase,
  readFixture,
  runPluginSqlBindingAudit,
  runVisitCase,
  writeSuiteArtifacts
} from './lib/visit-report-test-shared.mjs';

export async function runVisitReportSuite(cliFlags = {}) {
  const dbUrl = String(cliFlags['db-url'] || DEFAULT_E2E_DB_URL);
  const outputDir = String(cliFlags['output-dir'] || DEFAULT_OUTPUT_DIR);
  const jsonOnly = Boolean(cliFlags['json-only']);
  const smokeOnly = Boolean(cliFlags['smoke-only']);
  const fieldsOnly = Boolean(cliFlags['fields-only']);
  const cases = [];

  cases.push(await runPluginSqlBindingAudit());

  if (cases.some((entry) => entry.status === 'failed')) {
    const suiteResult = buildSuiteResult(cases);
    const artifacts = await writeSuiteArtifacts(suiteResult, outputDir, 'visit-report');
    const payload = {
      ...suiteResult,
      artifacts: {
        jsonPath: artifacts.jsonPath,
        markdownPath: artifacts.markdownPath
      },
      databaseUrlMasked: maskDatabaseUrl(dbUrl)
    };

    if (jsonOnly) {
      console.log(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      console.log(`Visit Report E2E Suite: ${payload.status.toUpperCase()}`);
      console.log(`Database: ${payload.databaseUrlMasked}`);
      console.log(`Cases: ${payload.summary.totalCases}`);
      console.log(`Passed: ${payload.summary.passedCases}`);
      console.log(`Failed: ${payload.summary.failedCases}`);
      console.log(`JSON report: ${artifacts.jsonPath}`);
      console.log(`Markdown report: ${artifacts.markdownPath}`);
      console.log('');
      console.log('Preflight audit failed: il layer DB reale contiene pattern non sicuri per @tauri-apps/plugin-sql.');
    }

    return {
      payload,
      artifacts
    };
  }

  await prepareE2EDatabase(dbUrl);

  const baseline = await readFixture('visit-baseline.json');
  const fieldCases = await readFixture('visit-field-cases.json');

  if (!fieldsOnly) {
    cases.push(
      await runVisitCase({
        baseline,
        definition: {
          id: 'smoke-baseline',
          name: 'Smoke test completo',
          section: 'smoke',
          field: 'baseline',
          variant: 'default',
          expectedOutcome: 'report-success',
          generateReport: true,
          patch: {}
        },
        dbUrl,
        outputDir,
        phase: 'smoke'
      })
    );
  }

  if (!smokeOnly) {
    for (const definition of fieldCases) {
      cases.push(
        await runVisitCase({
          baseline,
          definition,
          dbUrl,
          outputDir,
          phase: 'field-sweep'
        })
      );
    }
  }

  const suiteResult = buildSuiteResult(cases);
  const artifacts = await writeSuiteArtifacts(suiteResult, outputDir, 'visit-report');

  const payload = {
    ...suiteResult,
    artifacts: {
      jsonPath: artifacts.jsonPath,
      markdownPath: artifacts.markdownPath
    },
    databaseUrlMasked: maskDatabaseUrl(dbUrl)
  };

  if (jsonOnly) {
    console.log(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    console.log(`Visit Report E2E Suite: ${payload.status.toUpperCase()}`);
    console.log(`Database: ${payload.databaseUrlMasked}`);
    console.log(`Cases: ${payload.summary.totalCases}`);
    console.log(`Passed: ${payload.summary.passedCases}`);
    console.log(`Failed: ${payload.summary.failedCases}`);
    console.log(`Smoke passed: ${payload.summary.smokePassed ? 'yes' : 'no'}`);
    console.log(`JSON report: ${artifacts.jsonPath}`);
    console.log(`Markdown report: ${artifacts.markdownPath}`);

    const failedCases = payload.cases.filter((entry) => entry.status === 'failed');
    if (failedCases.length > 0) {
      console.log('');
      console.log('Failed cases:');
      for (const testCase of failedCases) {
        const errorMessage =
          testCase.errors[0]?.message ||
          testCase.toasts[0]?.message ||
          'Esito diverso da quello atteso';
        console.log(
          `- ${testCase.id} [${testCase.section}/${testCase.field}/${testCase.variant}]: ${errorMessage}`
        );
      }
    }
  }

  return {
    payload,
    artifacts
  };
}

async function main() {
  const flags = parseCliArgs(process.argv.slice(2));
  const { payload } = await runVisitReportSuite(flags);
  if (payload.status === 'failed') {
    process.exit(1);
  }
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  main().catch((error) => {
    console.error(
      JSON.stringify(
        {
          status: 'failed',
          message: error instanceof Error ? error.message : String(error)
        },
        null,
        2
      )
    );
    process.exit(1);
  });
}
