import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-6 md:px-12">
        <span className="text-lg font-semibold tracking-tight text-kick-blue">
          KickScholar
        </span>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" render={<Link href="/login">Log in</Link>} />
          <Button render={<Link href="/signup">Sign up</Link>} />
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center md:px-12">
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-balance md:text-6xl">
          Find universities and{" "}
          <span className="text-kick-green">scholarships</span> you actually{" "}
          <span className="text-kick-blue">qualify for</span>.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground text-balance">
          KickScholar matches your academic profile against real, sourced
          eligibility data — so every match comes with a clear reason why,
          and what to do next.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" render={<Link href="/signup">Get started</Link>} />
          <Button
            size="lg"
            variant="outline"
            render={<Link href="/login">I already have an account</Link>}
          />
        </div>
      </main>
    </div>
  );
}
