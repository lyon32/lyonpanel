// Nom de service « Type Réseau · qualificatifs · #id » : le titre en gras, le reste en dessous.
// Les mots longs passent à la ligne (break-words), jamais de défilement horizontal.
export function ServiceTitle({ name }: { name: string }) {
  const parts = name.split(' · ').map((p) => p.trim());
  const last = parts[parts.length - 1] ?? '';
  const idPart = parts.length > 1 && /^#\d+$/.test(last) ? parts.pop() : null;
  const [head, ...details] = parts;
  return (
    <span className="block min-w-0 break-words">
      <span className="text-encre block font-bold">{head}</span>
      {details.length > 0 ? (
        <span className="text-gris-600 mt-0.5 block text-sm">{details.join(' · ')}</span>
      ) : null}
      {idPart ? (
        <span className="text-gris-600 mt-0.5 block text-sm tabular-nums">{idPart}</span>
      ) : null}
    </span>
  );
}
