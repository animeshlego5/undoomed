// The "Un-Doomed" wordmark. One continuous blue stroke does double duty: it's the
// hyphen after "Un" AND the line crossing out "Doomed". Because it's a single drawn
// line (not a text glyph + a separate CSS line-through), the two halves can never
// fall out of alignment. The literal "Un-Doomed" text is preserved for copy/paste
// and screen readers; the visible hyphen is hidden so the stroke stands in for it.
export default function Wordmark({ className = "" }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      Un
      {/* real hyphen kept for copy/paste + screen readers, hidden visually */}
      <span className="sr-only">-</span>
      <span className="relative ml-[0.3em] inline-block leading-none">
        Doomed
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[-0.36em] right-0 top-[0.6em] h-[0.1em] -translate-y-1/2 rounded-full bg-accent"
        />
      </span>
    </span>
  );
}
