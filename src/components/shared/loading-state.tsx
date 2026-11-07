// Squelettes gris ; la pulsation s'arrête si l'utilisateur réduit les animations.
export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="mx-auto flex w-full max-w-md flex-col gap-3 p-4"
    >
      <div
        aria-hidden="true"
        className="bg-gris-200 h-6 w-1/2 animate-pulse rounded-lg motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="bg-gris-50 border-gris-200 h-24 w-full animate-pulse rounded-xl border motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="bg-gris-50 border-gris-200 h-24 w-full animate-pulse rounded-xl border motion-reduce:animate-none"
      />
    </div>
  );
}
