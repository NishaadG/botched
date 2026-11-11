import Link from "next/link";
import { MobileTabs, NavLinks } from "./nav-links";

/** The app mark: a chat bubble with one human eye and one robot eye. */
export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="96 110 320 320" aria-hidden className="shrink-0">
      <path
        d="M136 150h240a40 40 0 0 1 40 40v120a40 40 0 0 1-40 40H250l-62 48v-48h-52a40 40 0 0 1-40-40V190a40 40 0 0 1 40-40z"
        fill="#a3ff5c"
      />
      <rect x="180" y="210" width="44" height="60" rx="22" fill="#0f1a06" />
      <rect x="288" y="222" width="48" height="48" rx="6" fill="#ff4d8d" />
      <rect x="300" y="234" width="24" height="24" rx="3" fill="#0f1a06" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`glitch flex items-center gap-2 font-display text-xl font-extrabold tracking-tight ${className}`}>
      <Mark />
      botched
    </Link>
  );
}

export function Nav() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/60 bg-ink/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo className="shrink-0" />
          <NavLinks />
          <Link href="/play/whos-the-bot" className="btn btn-brand px-4 py-2 text-sm sm:hidden">
            Play
          </Link>
        </nav>
      </header>
      <MobileTabs />
    </>
  );
}
