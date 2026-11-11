import Link from "next/link";
import { Mark, Nav } from "@/components/nav";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-grid">
      <Nav />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
        <Mark size={72} />
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-hot">404</p>
        <h1 className="font-display text-4xl font-black md:text-5xl">This page is a bot.</h1>
        <p className="text-lg text-muted">Or it never existed. Either way, there&apos;s nothing here. If you have a room code, try joining from the game page.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/play/whos-the-bot" className="btn btn-brand">
            Start or join a game
          </Link>
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}
