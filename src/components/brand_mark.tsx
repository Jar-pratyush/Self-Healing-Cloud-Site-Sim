type BrandMarkProps = {
  size?: number;
};

// The site mark: a flat signal that breaks (fault) and comes back (repair).
// Same drawing as public/favicon.svg, but it follows the active theme.
export function BrandMark({ size = 30 }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="brand_mark">
      <rect width="64" height="64" rx="14" fill="var(--color_panel_strong)" stroke="var(--color_line)" />
      <path
        d="M8 32h11l4-14 6 30"
        fill="none"
        stroke="var(--color_fault)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M29 48l5-22 4 6h18"
        fill="none"
        stroke="var(--color_agent)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="56" cy="32" r="3.5" fill="var(--color_agent)" />
    </svg>
  );
}
