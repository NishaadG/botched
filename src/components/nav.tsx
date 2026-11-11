import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-display text-xl font-extrabold tracking-tight ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-brand-ink text-lg glitch" aria-hidden>
        ◉
      </span>
      botched
    </Link>
  );
}

const links = [
  { href: "/play", label: "Play" },
  { href: "/lounge", label: "Lounge" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/how-to-play", label: "How to play" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-ink/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <div className="flex items-center gap-1 overflow-x-auto text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3 py-2 text-muted transition hover:bg-white/5 hover:text-text">
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
