import Link from "next/link";
import { ANDROID_APK_URL } from "@/lib/constants";
import { Logo } from "./nav";

const LINKS: [string, string][] = [
  ["/play", "games"],
  ["/how-to-play", "rules"],
  ["/lounge", "lounge"],
  ["/leaderboard", "ranks"],
  ["/stats", "live stats"],
  ["/me", "your stats"],
  ["/privacy", "privacy"],
];

export function Footer() {
  return (
    <footer className="border-t border-line/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="max-w-sm text-xs leading-relaxed text-muted">
            Party games for your group chat. Real-time messaging by Nexconn Chat.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs uppercase tracking-widest text-muted sm:grid-cols-4">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-brand">
              <span className="text-line">/</span>
              {label}
            </Link>
          ))}
          <a href={ANDROID_APK_URL} className="hover:text-brand">
            <span className="text-line">/</span>android app
          </a>
        </nav>
      </div>
    </footer>
  );
}
