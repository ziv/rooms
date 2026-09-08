import { cn } from "@/lib/utils";

/**
 * Hand-drawn vector flowers used on the login page. Colours come from the theme
 * (`--petal-*`, `--leaf*`) so the illustration follows the palette.
 */
export function Flowers({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 360"
      className={cn("w-full h-auto", className)}
      aria-hidden
      focusable="false"
      role="presentation"
    >
      <defs>
        <g id="petal5">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-16" rx="9" ry="16" transform={`rotate(${a})`} />
          ))}
        </g>
        <g id="petal6">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path key={a} d="M0 0 C -9 -8, -9 -24, 0 -30 C 9 -24, 9 -8, 0 0 Z" transform={`rotate(${a})`} />
          ))}
        </g>
        <path id="leaf" d="M0 0 C 14 -6, 30 -4, 40 8 C 30 16, 12 16, 0 0 Z" />
      </defs>

      {/* ground haze */}
      <ellipse cx="240" cy="330" rx="210" ry="22" fill="var(--secondary)" />

      {/* stems */}
      <g fill="none" stroke="var(--leaf-dark)" strokeWidth="3" strokeLinecap="round">
        <path d="M120 330 C 118 260, 128 200, 150 140" />
        <path d="M200 330 C 205 250, 190 180, 212 100" />
        <path d="M282 330 C 276 270, 292 200, 270 130" />
        <path d="M356 330 C 352 280, 372 230, 340 170" />
        <path d="M165 330 C 168 300, 160 280, 178 250" />
        <path d="M318 330 C 316 305, 330 290, 322 262" />
      </g>

      {/* leaves */}
      <g fill="var(--leaf)">
        <use href="#leaf" transform="translate(124 250) rotate(-30)" />
        <use href="#leaf" transform="translate(140 205) rotate(-150) scale(-1 1)" />
        <use href="#leaf" transform="translate(203 215) rotate(-40)" />
        <use href="#leaf" transform="translate(196 170) rotate(-140) scale(-1 1)" />
        <use href="#leaf" transform="translate(284 240) rotate(-35)" />
        <use href="#leaf" transform="translate(288 190) rotate(-145) scale(-1 1)" />
        <use href="#leaf" transform="translate(360 270) rotate(-25)" />
        <use href="#leaf" transform="translate(352 225) rotate(-155) scale(-1 1)" />
        <use href="#leaf" transform="translate(170 290) rotate(-50)" />
        <use href="#leaf" transform="translate(322 300) rotate(-130) scale(-1 1)" />
      </g>

      {/* blossoms */}
      <g transform="translate(150 140)">
        <use href="#petal5" fill="var(--petal-rose)" />
        <circle r="7" fill="var(--petal-peach)" />
      </g>
      <g transform="translate(212 100) rotate(15)">
        <use href="#petal6" fill="var(--petal-lavender)" />
        <circle r="8" fill="var(--petal-peach)" />
        <circle r="3.5" fill="var(--leaf-dark)" opacity="0.6" />
      </g>
      <g transform="translate(270 130) rotate(-10)">
        <use href="#petal5" fill="var(--petal-peach)" />
        <circle r="7" fill="var(--petal-rose)" />
      </g>
      <g transform="translate(340 170) rotate(25)">
        <use href="#petal6" fill="var(--petal-rose)" />
        <circle r="8" fill="var(--petal-lavender)" />
        <circle r="3.5" fill="var(--leaf-dark)" opacity="0.6" />
      </g>
      {/* buds */}
      <g fill="var(--petal-lavender)">
        <ellipse cx="178" cy="248" rx="7" ry="11" transform="rotate(20 178 248)" />
        <ellipse cx="322" cy="260" rx="7" ry="11" transform="rotate(-15 322 260)" />
      </g>
      <g fill="var(--leaf-dark)" opacity="0.8">
        <path d="M172 256 q6 -4 12 0 l-6 10 z" />
        <path d="M316 268 q6 -4 12 0 l-6 10 z" />
      </g>

      {/* floating petals */}
      <g fill="var(--petal-rose)" opacity="0.8">
        <ellipse cx="80" cy="120" rx="6" ry="10" transform="rotate(30 80 120)" />
        <ellipse cx="410" cy="90" rx="6" ry="10" transform="rotate(-40 410 90)" />
        <ellipse cx="60" cy="200" rx="5" ry="8" transform="rotate(-20 60 200)" />
      </g>
      <g fill="var(--petal-lavender)" opacity="0.8">
        <ellipse cx="430" cy="210" rx="5" ry="9" transform="rotate(50 430 210)" />
        <ellipse cx="100" cy="60" rx="5" ry="8" transform="rotate(10 100 60)" />
      </g>
    </svg>
  );
}

/** Small five-petal mark used as the app logo. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden focusable="false">
      <g transform="translate(16 16)">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="0" cy="-8" rx="4.5" ry="8" fill="var(--petal-rose)" transform={`rotate(${a})`} />
        ))}
        <circle r="4" fill="var(--primary)" />
      </g>
    </svg>
  );
}
