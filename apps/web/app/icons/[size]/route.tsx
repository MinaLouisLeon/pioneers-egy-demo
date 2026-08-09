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
        background: "#7a1f23",
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
          d="M16 2.2 4.2 6.9v9.4c0 6.6 4.8 11.7 11.8 13.6 7-1.9 11.8-7 11.8-13.6V6.9L16 2.2Z"
          fill="#1d3b5d"
        />
        <circle cx="16" cy="15.6" r="4.3" stroke="#ffffff" strokeWidth="1.7" />
        <circle cx="16" cy="15.6" r="1.3" fill="#f97415" />
        <path
          d="M16 8.6v2.4M16 20.2v2.4M9 15.6h2.4m9.2 0H23"
          stroke="#ffffff"
          strokeWidth="1.7"
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
