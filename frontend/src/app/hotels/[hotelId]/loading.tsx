export default function HotelSegmentLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading page">
      <div className="h-8 w-48 rounded-md bg-muted/70" />
      <div className="h-32 w-full rounded-xl bg-muted/50" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 rounded-lg bg-muted/40" />
        <div className="h-24 rounded-lg bg-muted/40" />
        <div className="h-24 rounded-lg bg-muted/40" />
      </div>
    </div>
  );
}
