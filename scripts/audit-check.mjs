// Audit des dépendances : échoue sur toute alerte « haute » ou « critique », sauf les failles
// listées ci-dessous (acceptées par le propriétaire, sans correctif publié). Retirer l'entrée dès qu'un correctif existe.
import { execSync } from 'node:child_process';

const ACCEPTED = new Set([
  // picomatch <= 4.0.7 (ReDoS) : outils de build seulement, aucune version corrigée publiée (accepté le 2026-11-18).
  'GHSA-fc5q-39xc-vjpf',
]);

let raw;
try {
  raw = execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (error) {
  // npm audit sort en code 1 quand il trouve des alertes : le JSON est dans la sortie.
  raw = error.stdout;
}

const vulnerabilities = JSON.parse(raw).vulnerabilities ?? {};

// Seules les failles directes comptent : un paquet « haut » par simple transmission suit sa cause.
const blocking = [
  ...new Set(
    Object.values(vulnerabilities).flatMap((vuln) =>
      vuln.via
        .filter((cause) => typeof cause === 'object')
        .filter((cause) => cause.severity === 'high' || cause.severity === 'critical')
        .filter((cause) => !ACCEPTED.has(String(cause.url).split('/').pop()))
        .map((cause) => `${cause.name} (${cause.url})`),
    ),
  ),
];

if (blocking.length > 0) {
  process.stderr.write(`Alertes hautes non acceptées : ${blocking.join(', ')}\n`);
  process.exit(1);
}
process.stdout.write('Audit : aucune alerte haute hors failles acceptées.\n');
