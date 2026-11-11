import Link from "next/link";
import { Logo } from "./nav";

export function Footer() {
  return (
    <footer className="border-t border-line/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="max-w-sm text-sm text-muted">Party games for your group chat. Real-time messaging powered by Nexconn Chat.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/play" className="hover:text-text">Games</Link>
          <Link href="/how-to-play" className="hover:text-text">How to play</Link>
          <Link href="/lounge" className="hover:text-text">Lounge</Link>
          <Link href="/leaderboard" className="hover:text-text">Leaderboard</Link>
          <Link href="/stats" className="hover:text-text">Live stats</Link>
          <Link href="/me" className="hover:text-text">Your stats</Link>
        </nav>
      </div>
    </footer>
  );
}
