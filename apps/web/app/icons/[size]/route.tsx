import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

/**
 * PWA icons, generated from the company emblem in public/brand/emblem.png.
 *
 * Generated rather than committed as fixed-size binaries so the icon can never
 * drift from the brand asset, and any size can be produced on demand. The
 * emblem is inlined as a data URI because the renderer has no network access.
 *
 * Cached hard: the output only changes when the emblem or this file does.
 */

const ALLOWED_SIZES = [192, 512] as const;

/** The emblem's own maroon, so the padding around it is invisible. */
const BRAND_MAROON = "#7a1f23";

export function generateStaticParams() {
  return ALLOWED_SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: sizeParam } = await params;
  const size = Number(sizeParam);

  if (!ALLOWED_SIZES.includes(size as (typeof ALLOWED_SIZES)[number])) {
    return new Response("Not found", { status: 404 });
  }

  const emblem = await readFile(path.join(process.cwd(), "public", "brand", "emblem.png"));
  const emblemDataUri = `data:image/png;base64,${emblem.toString("base64")}`;

  /*
   * Maskable icons are cropped to a circle of roughly 80% of the canvas on
   * Android, so the emblem is inset to stay inside that safe area. The
   * surrounding fill is the emblem's own maroon, so the inset is invisible.
   */
  const inset = Math.round(size * 0.14);

  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_MAROON,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={emblemDataUri}
        alt=""
        width={size - inset * 2}
        height={size - inset * 2}
        style={{ objectFit: "contain" }}
      />
    </div>,
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
