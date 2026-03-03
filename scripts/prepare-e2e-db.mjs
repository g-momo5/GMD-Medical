import {
  DEFAULT_E2E_DB_URL,
  maskDatabaseUrl,
  parseCliArgs,
  prepareE2EDatabase
} from './lib/visit-report-test-shared.mjs';

async function main() {
  const flags = parseCliArgs(process.argv.slice(2));
  const dbUrl = String(flags['db-url'] || DEFAULT_E2E_DB_URL);
  const result = await prepareE2EDatabase(dbUrl);

  console.log(
    JSON.stringify(
      {
        status: 'prepared',
        databaseUrl: maskDatabaseUrl(result.databaseUrl)
      },
      null,
      2
    )
  );
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
