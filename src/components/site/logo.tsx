/** Wordmark: an envelope outline drawn as a single gore line, set beside the name. */
export function Logo({ className = "", inverted = false }: { className?: string; inverted?: boolean }) {
  const stroke = inverted ? "#f6f2e8" : "#12243f";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden="true">
        <path d="M11 1.5C5.6 1.5 1.5 5.6 1.5 11c0 4.6 3.4 8.4 6.2 11h6.6c2.8-2.6 6.2-6.4 6.2-11 0-5.4-4.1-9.5-9.5-9.5Z" fill="none" stroke={stroke} strokeWidth="1.4" />
        <path d="M11 1.5c-2.6 2.4-3.6 6-3.6 9.5s1 7.6 0.3 11M11 1.5c2.6 2.4 3.6 6 3.6 9.5s-1 7.6-0.3 11" fill="none" stroke={stroke} strokeWidth="1" opacity="0.6" />
        <rect x="8" y="24" width="6" height="3" rx="0.6" fill="#c05f2a" />
      </svg>
      <span className={`font-serif text-[1.15rem] font-medium tracking-tight ${inverted ? "text-ivory" : "text-ink"}`}>Balloon Bluebook</span>
    </span>
  );
}
