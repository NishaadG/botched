import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { LoungeClient } from "@/components/lounge-client";

export const metadata: Metadata = {
  title: "Lounge",
  description: "A public chat room for finding players and jumping into open games.",
};

export default function LoungePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-grid">
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-10">
        <header className="mb-6">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand">Lounge</p>
          <h1 className="mt-2 font-display text-4xl font-black md:text-5xl">Find people to play with</h1>
        </header>
        <LoungeClient />
      </main>
    </div>
  );
}
