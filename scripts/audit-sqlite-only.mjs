import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOTS = ['src', 'src-tauri'];
const SCANNED_EXTENSIONS = new Set([
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.svelte',
  '.json',
  '.toml',
  '.rs',
  '.md'
]);
const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'target', '.svelte-kit', 'build', 'dist']);
const IGNORED_FILES = new Set(['Cargo.lock']);
const FORBIDDEN_DATABASE_URI_PATTERN =
  /\b(postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|sqlserver|oracle|cockroachdb|redis):(?=\/\/|[^\s/])/gi;

const violations = [];

function walk(currentPath) {
  for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        walk(join(currentPath, entry.name));
      }
      continue;
    }

    if (IGNORED_FILES.has(entry.name)) {
      continue;
    }

    if (!SCANNED_EXTENSIONS.has(extname(entry.name))) {
      continue;
    }

    const filePath = join(currentPath, entry.name);
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      FORBIDDEN_DATABASE_URI_PATTERN.lastIndex = 0;
      const match = FORBIDDEN_DATABASE_URI_PATTERN.exec(line);
      if (!match) {
        continue;
      }

      violations.push({
        filePath,
        lineNumber: lineIndex + 1,
        value: match[0],
        line: line.trim()
      });
    }
  }
}

for (const root of ROOTS) {
  walk(root);
}

if (violations.length > 0) {
  console.error('Audit SQLite-only fallito: trovati URI database non-SQLite.\n');
  for (const violation of violations) {
    console.error(`${violation.filePath}:${violation.lineNumber} -> ${violation.value}`);
    console.error(`  ${violation.line}`);
  }
  process.exit(1);
}

console.log('Audit SQLite-only OK: nessun URI database non-SQLite in src/ e src-tauri/.');
