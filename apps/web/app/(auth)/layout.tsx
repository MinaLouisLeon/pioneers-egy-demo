import { BrandLockup } from "@/components/brand";

/**
 * Split layout: the form column is centred and full-width on small screens; the
 * brand panel only appears from `lg` up, where there is room for it.
 *
 * The panel mirrors the hero on pioneers-egy.com — the navy gradient, the
 * orange-highlighted headline word, and the company's own positioning line.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center lg:justify-start">
          <BrandLockup showTagline />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      <div className="bg-gradient-hero relative hidden overflow-hidden lg:block">
        {/* Engineering blueprint grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Warm glow, picking up the brand orange */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 78% 22%, rgba(249,116,21,.28) 0, transparent 45%), radial-gradient(circle at 15% 85%, rgba(122,31,35,.5) 0, transparent 50%)",
          }}
        />

        <div className="relative flex h-full flex-col justify-end gap-8 p-12 text-white">
          <div className="grid grid-cols-3 gap-6 border-b border-white/15 pb-8">
            <Stat value="15+" label="Years experience" />
            <Stat value="500+" label="Projects completed" />
            <Stat value="50+" label="Expert engineers" />
          </div>

          <blockquote className="max-w-lg">
            <p className="text-balance font-serif text-3xl font-bold leading-tight">
              Excellence in <span className="text-highlight">Engineering</span> Inspection &amp;
              Testing
            </p>
            <footer className="mt-4 text-balance text-sm leading-relaxed text-white/75">
              Every lift, weld and test recorded on site — and verifiable anywhere. Lifting · NDT ·
              Testing · Environmental.
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-highlight font-serif text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-white/70">{label}</div>
    </div>
  );
}
