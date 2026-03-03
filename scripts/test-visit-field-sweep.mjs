import { parseCliArgs } from './lib/visit-report-test-shared.mjs';
import { runVisitReportSuite } from './test-visit-report-agent.mjs';

async function main() {
  const flags = parseCliArgs(process.argv.slice(2));
  const { payload } = await runVisitReportSuite({
    ...flags,
    'fields-only': true
  });

  if (payload.status === 'failed') {
    process.exit(1);
  }
}

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
