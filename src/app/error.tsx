"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-grid px-4 text-center">
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-hot">Something broke</p>
      <h1 className="font-display text-4xl font-black">Well, that was botched.</h1>
      <p className="max-w-md text-muted">Something went wrong on our side. Try again; if you were in a game, your room is still there.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button className="btn btn-brand" onClick={() => retry()}>
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Home
        </Link>
      </div>
    </main>
  );
}
