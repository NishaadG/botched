"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Simple line icons, drawn on a 24px grid. */
const ICONS: Record<string, React.ReactNode> = {
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  lounge: <path d="M4 5h16v11H9l-5 4z" />,
  ranks: (
    <>
      <path d="M4 20V13h4v7M10 20V8h4v12M16 20v-9h4v9" />
    </>
  ),
  rules: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M9 10h6M9 14h6" />
    </>
  ),
  me: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5" />
    </>
  ),
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

const LINKS = [
  { href: "/play", label: "Play", icon: "play" },
  { href: "/lounge", label: "Lounge", icon: "lounge" },
  { href: "/leaderboard", label: "Ranks", icon: "ranks" },
  { href: "/how-to-play", label: "Rules", icon: "rules" },
  { href: "/me", label: "Me", icon: "me" },
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
                <Icon name={l.icon} />
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
