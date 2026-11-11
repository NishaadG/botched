"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/play", label: "Play", icon: "🎮" },
  { href: "/lounge", label: "Lounge", icon: "💬" },
  { href: "/leaderboard", label: "Ranks", icon: "🏆" },
  { href: "/how-to-play", label: "Rules", icon: "📖" },
  { href: "/me", label: "Me", icon: "🙂" },
];

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function NavLinks() {
  const path = usePathname();
  return (
    <div className="hidden items-center gap-1 text-sm sm:flex">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={isActive(path, l.href) ? "page" : undefined}
          className="rounded-full px-3 py-2 text-muted transition hover:bg-white/5 hover:text-text aria-[current=page]:bg-white/5 aria-[current=page]:text-text"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

/** Bottom tab bar on phones, which also makes the installed app feel native. */
export function MobileTabs() {
  const path = usePathname();
  return (
    <nav
      className="mobile-tabs fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-ink/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
      aria-label="Main"
    >
      <ul className="grid grid-cols-5">
        {LINKS.map((l) => {
          const active = isActive(path, l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${active ? "text-brand" : "text-muted"}`}
              >
                <span className={`text-lg leading-none ${active ? "" : "grayscale opacity-70"}`} aria-hidden>
                  {l.icon}
                </span>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
