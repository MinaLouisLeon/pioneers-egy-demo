import { ImageResponse } from "next/og";

/**
 * PWA icons, generated at request time rather than committed as binaries.
 *
 * Keeps the repository free of image assets that would drift from the brand
 * mark in components/brand.tsx, and lets any size be produced on demand.
 * Cached hard because the output only changes when this file does.
 */

const ALLOWED_SIZES = [192, 512] as const;

export function generateStaticParams() {
  return ALLOWED_SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: sizeParam } = await params;
  const size = Number(sizeParam);

  if (!ALLOWED_SIZES.includes(size as (typeof ALLOWED_SIZES)[number])) {
    return new Response("Not found", { status: 404 });
  }

  // Maskable icons must keep their content inside a safe circle of ~80% of the
  // canvas, or Android will crop the mark when it applies a shape mask.
  const inset = size * 0.2;
  const glyph = size - inset * 2;

  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1d3a63",
      }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16 2.5 4.5 7v9.2c0 6.4 4.7 11.4 11.5 13.3 6.8-1.9 11.5-6.9 11.5-13.3V7L16 2.5Z"
          fill="rgba(255,255,255,0.14)"
          stroke="#ffffff"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="15" r="4.6" stroke="#ffffff" strokeWidth="1.9" />
        <path
          d="M16 7.6v2.4M16 20v2.4M8.6 15H11m10 0h2.4"
          stroke="#ffffff"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
