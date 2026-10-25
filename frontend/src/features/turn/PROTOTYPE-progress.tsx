// PROTOTYPE (prototype/turn-ui): tiny progress bar (shadcn Progress not installed).
export function Progress({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-sky-400 transition-[width] duration-500"
        style={{ width: `${String((value / max) * 100)}%` }}
      />
    </div>
  );
}
