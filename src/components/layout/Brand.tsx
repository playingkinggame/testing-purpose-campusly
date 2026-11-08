export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-xl font-bold text-forest ${className}`}>
      <img src="/icons/icon.svg" alt="" aria-hidden="true" className="h-8 w-8" />
      Campusly
    </span>
  );
}
