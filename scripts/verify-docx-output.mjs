import {
  parseCliArgs,
  verifyDocxFile
} from './lib/visit-report-test-shared.mjs';

async function main() {
  const flags = parseCliArgs(process.argv.slice(2));
  const filePath = flags.path || flags.file;

  if (!filePath) {
    throw new Error('Specifica --path <file.docx>');
  }

  const result = await verifyDocxFile(String(filePath));
  console.log(`${JSON.stringify(result, null, 2)}\n`);
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
