import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[24px] bg-white shadow-raised lg:min-h-[640px] lg:grid-cols-2">
        {/* Night panel with the Nordic scene (docs/ui-remodel.md §9.10). */}
        <div aria-hidden="true" className="relative hidden overflow-hidden bg-night lg:block">
          <Image src="/scenes/nordic.svg" alt="" fill unoptimized priority className="object-cover object-bottom" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,29,51,.9)_0%,rgba(7,29,51,.55)_45%,rgba(7,29,51,0)_75%)]" />
          <p className="absolute inset-x-10 top-12 font-display text-[34px] leading-[1.08] font-bold tracking-[-0.02em] text-balance text-white">
            Find the programmes and scholarships you actually qualify for.
          </p>
        </div>

        <div className="flex flex-col justify-center p-8 md:p-12">
          <Link
            href="/"
            className="mb-8 inline-flex min-h-11 w-fit items-center font-display text-[26px] font-[750] tracking-[-0.03em] text-kick-blue"
          >
            KickScholar
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
