// Squelette affiché pendant le chargement d'un écran de gestion.
export default function AdminPanelLoading() {
  const block = 'bg-gris-200 animate-pulse rounded-xl motion-reduce:animate-none';
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div className={`${block} h-8 w-48`} />
      <div className={`${block} h-11 w-full max-w-sm`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`${block} h-24`} />
        ))}
      </div>
    </div>
  );
}
