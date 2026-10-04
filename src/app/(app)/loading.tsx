export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-2/3 rounded-lg bg-line" />
      <div className="h-14 rounded-2xl bg-line" />
      <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-line" />)}</div>
    </div>
  );
}
