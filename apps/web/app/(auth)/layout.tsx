import { BrandLockup } from "@/components/brand";

/**
 * Split layout: the form column is centred and full-width on small screens; the
 * marketing panel only appears from `lg` up, where there is room for it.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center lg:justify-start">
          <BrandLockup showTagline />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      <div className="bg-primary relative hidden overflow-hidden lg:block">
        <div
          aria-hidden
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,.5) 0, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,.35) 0, transparent 40%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="text-primary-foreground relative flex h-full flex-col justify-end p-12">
          <blockquote className="max-w-md">
            <p className="text-balance text-2xl font-medium leading-snug">
              Every lift, weld and test — recorded on site, verifiable anywhere.
            </p>
            <footer className="mt-4 text-sm opacity-80">
              Lifting · NDT · Testing · Environmental
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
