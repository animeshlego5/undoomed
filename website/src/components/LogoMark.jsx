// The Un-Doomed mark: a phone whose body forms a "D", struck through —
// doomscrolling, crossed out. Strokes are the brand blue; `knockout` must
// match the background the mark sits on (it carves the gap around the slash).
export default function LogoMark({
  size = 28,
  knockout = "#f0efe3",
  stroke = "#2563eb",
  className = "",
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M37 16 H50 C73 16 84 31 84 50 C84 69 73 84 50 84 H37 Q28 84 28 75 V25 Q28 16 37 16 Z"
        stroke={stroke}
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <path
        d="M45 27 H58"
        stroke={stroke}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <circle cx="50.5" cy="71.5" r="4" fill={stroke} />
      <path
        d="M13 31 L91 80"
        stroke={knockout}
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        d="M13 31 L91 80"
        stroke={stroke}
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}
