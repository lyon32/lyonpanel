// Vérifie qu'aucun secret ne se trouve dans les fichiers envoyés au navigateur (.next/static).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SECRET_VARIABLES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'JAP_API_KEY',
  'SASPAY_API_KEY',
  'SASPAY_WEBHOOK_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'TURNSTILE_SECRET_KEY',
  'CRON_SECRET',
  'SENTRY_AUTH_TOKEN',
];

const PATTERNS = [
  'sk_live_',
  'sk_test_',
  'service_role',
  'JAP_API_KEY',
  'SASPAY_API_KEY',
  'SASPAY_WEBHOOK_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'CRON_SECRET',
  'SENTRY_AUTH_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY',
];

// Les valeurs très courtes (ex. « mock ») donneraient de faux positifs.
const MIN_SECRET_LENGTH = 8;

/** Liste récursivement les fichiers, sans les source maps (non servies au navigateur). */
function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return entry.name.endsWith('.map') ? [] : [path];
  });
}

/**
 * @param {string} dir
 * @param {string[]} needles
 * @returns {{ file: string; needle: string }[]}
 */
export function findSecrets(dir, needles) {
  const found = [];
  for (const file of listFiles(dir)) {
    const content = readFileSync(file, 'utf8');
    for (const needle of needles) {
      if (needle && content.includes(needle)) found.push({ file, needle });
    }
  }
  return found;
}

function main() {
  const dir = '.next/static';
  if (!existsSync(dir)) {
    process.stderr.write(`Dossier introuvable : ${dir} (lancer npm run build avant).\n`);
    process.exit(1);
  }
  const values = SECRET_VARIABLES.map((name) => process.env[name] ?? '').filter(
    (value) => value.length >= MIN_SECRET_LENGTH,
  );
  const results = findSecrets(dir, [...new Set([...values, ...PATTERNS])]);
  for (const { file, needle } of results) {
    // On n'affiche jamais la valeur d'un secret : seulement sa longueur si ce n'est pas un motif.
    const label = PATTERNS.includes(needle)
      ? needle
      : `valeur secrète (${needle.length} caractères)`;
    process.stderr.write(`SECRET TROUVÉ dans ${file} : ${label}\n`);
  }
  if (results.length > 0) process.exit(1);
  process.stdout.write('Aucun secret dans le JavaScript du navigateur.\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
