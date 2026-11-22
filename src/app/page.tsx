import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { LiveStatsSection } from "@/components/hub/live-stats";
import { DemoChat } from "@/components/landing/demo-chat";
import { Nav } from "@/components/nav";
import { ANDROID_APK_URL } from "@/lib/constants";
import { SOLO_MODES, TAGLINE } from "@/lib/game/modes";

/** "How a game goes", written as a manual page. */
const STEPS: [string, string][] = [
  ["Send one link.", "Make a room, share the link or QR code. Friends join with a nickname. No app, no sign-up."],
  ["Masks on.", "Everyone gets a random alias. So does the AI, which joins the chat as one of you. Nobody knows which."],
  ["Answer in private.", "The game master asks a question. Answers stay hidden until everyone is in, then drop together."],
  ["Argue, then vote.", "60 seconds to work out whose answer sounded like a machine. Then the chat locks and you vote someone out."],
  ["Masks off.", "Real names, every vote, a replay of the chat, and everything the bot was thinking."],
];

/** The opponent, as a process listing. */
const BOT_STATUS: [string, string][] = [
  ["alias", "??? (that's the game)"],
  ["persona", "new every game: slang, casing, typo rate, typing speed"],
  ["reads", "your answers, before it writes its own"],
  ["remembers", "the names you call each other"],
  ["goal", "survive the vote"],
  ["helpful", "false"],
];

const THOUGHTS = [
  ["R1", "whale's answer is too clean. agree with owl about fox, stay quiet."],
  ["R2", "they noticed i answered fast. slow down, add a typo, blame fox."],
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Nav />

      <section className="bg-grid border-b border-line/60">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-14 pt-10 md:grid-cols-[1.05fr_1fr] md:pb-20 md:pt-16">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">{">"} game 01 · who&apos;s the bot</p>
            <h1 className="crt glow mt-4 text-[4.2rem] leading-[0.82] text-brand sm:text-8xl md:text-7xl lg:text-[6rem] xl:text-[6.75rem]">
              ONE OF YOUR
              <br />
              FRIENDS IS
              <br />
              <span className="cursor">A BOT.</span>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
              An AI joins your group chat wearing an alias, same as everyone else. It reads your answers, then writes one that
              fits right in. Find it before it outlasts you.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              <Link href="/play/whos-the-bot" className="btn btn-brand px-7 py-4">
                Start a game
              </Link>
              <Link href="/play/whos-the-bot?solo=1" className="btn btn-ghost px-6 py-4">
                Play solo now
              </Link>
            </div>
            <p className="mt-5 text-xs text-muted">
              <span className="text-brand">$</span> 2-8 players · quick match · 5 solo modes · any phone ·{" "}
              <Link href="/how-to-play" className="text-text underline decoration-line underline-offset-4 hover:decoration-brand">
                rules
              </Link>
            </p>
          </div>
          <DemoChat />
        </div>
      </section>

      <main className="flex flex-col gap-20 py-16 md:gap-28 md:py-24">
        <Suspense fallback={null}>
          <LiveStatsSection
            title="live numbers"
            className="mx-auto w-full max-w-6xl px-4"
            aside={
              <Link href="/leaderboard" className="text-xs uppercase tracking-widest text-muted hover:text-brand">
                [ranks]
              </Link>
            }
          />
        </Suspense>

        <section className="mx-auto w-full max-w-6xl px-4">
          <div className="card overflow-hidden">
            <div className="flex justify-between gap-4 border-b border-line/80 px-5 py-2.5 text-[11px] uppercase tracking-widest text-muted">
              <span>whos-the-bot(6)</span>
              <span className="hidden sm:inline">botched games manual</span>
              <span>whos-the-bot(6)</span>
            </div>
            <div className="grid gap-8 p-5 md:grid-cols-[11rem_1fr] md:gap-x-10 md:p-8">
              <h2 className="crt text-3xl leading-none text-brand">NAME</h2>
              <p className="text-sm text-text md:pt-1">
                whos-the-bot <span className="text-muted">-</span> one of your friends is a bot
              </p>
              <h2 className="crt text-3xl leading-none text-brand">SYNOPSIS</h2>
              <p className="text-sm text-text md:pt-1">
                link <span className="text-muted">→</span> answer <span className="text-muted">→</span> discuss{" "}
                <span className="text-muted">→</span> vote <span className="text-muted">[×3]</span>
              </p>
              <h2 className="crt text-3xl leading-none text-brand">HOW IT GOES</h2>
              <ol className="flex flex-col gap-4">
                {STEPS.map(([t, b], i) => (
                  <li key={t} className="grid grid-cols-[2rem_1fr] text-sm">
                    <span className="text-muted">{String(i + 1).padStart(2, "0")}</span>
                    <p>
                      <b className="font-semibold text-text">{t}</b> <span className="text-muted">{b}</span>
                    </p>
                  </li>
                ))}
              </ol>
              <h2 className="crt text-3xl leading-none text-brand">WINNING</h2>
              <p className="text-sm text-muted md:pt-1">
                Humans win the moment the bot is voted out. The bot wins if it survives every round, or if only one human is
                left beside it.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 md:grid-cols-[1fr_1.1fr] md:items-center md:gap-14">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-hot">{">"} the opponent</p>
            <h2 className="crt glow mt-3 text-6xl leading-[0.85] text-text md:text-7xl">
              A BOT BUILT
              <br />
              TO <span className="text-hot">BLEND IN.</span>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Most chatbots try to be helpful. This one tries not to get caught. When the game ends you get to read what it
              was thinking the whole time.
            </p>
          </div>
          <div className="card overflow-hidden font-mono text-[13px]">
            <p className="border-b border-line/80 px-4 py-2.5 text-muted">
              <span className="text-brand">$</span> botctl inspect --player <span className="text-hot">???</span>
            </p>
            <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 px-4 py-4">
              {BOT_STATUS.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className={k === "helpful" ? "text-hot" : "text-text"}>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-line/80 px-4 py-3">
              <p className="mb-2 text-[11px] uppercase tracking-widest text-muted">inner thoughts · shown after the game</p>
              <ul className="flex flex-col gap-1.5">
                {THOUGHTS.map(([r, t]) => (
                  <li key={r} className="flex gap-3">
                    <span className="text-muted">{r}</span>
                    <span className="text-text/90">&quot;{t}&quot;</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4">
          <div className="card relative overflow-hidden px-5 py-10 md:px-10 md:py-14">
            <div className="scanbar" />
            <p className="text-xs uppercase tracking-[0.3em] text-muted">{">"} solo · who&apos;s the human</p>
            <h2 className="crt glow mt-3 max-w-4xl text-6xl leading-[0.85] text-brand md:text-8xl">{TAGLINE.solo.toUpperCase()}</h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
              Nobody around? Flip the game. You are the only human in a chat full of AIs, and they are hunting you. Pass as one
              of them.
            </p>
            <ol className="mt-8 flex flex-col border-t border-line/80">
              {SOLO_MODES.map((m, i) => (
                <li key={m.id} className="grid grid-cols-[2.5rem_1fr] items-baseline gap-x-3 border-b border-line/80 py-3 sm:grid-cols-[2.5rem_12rem_1fr]">
                  <span className="text-xs text-muted">[{i + 1}]</span>
                  <span className="crt text-3xl leading-none text-brand">{m.label.toUpperCase()}</span>
                  <span className="col-start-2 mt-1 text-sm text-muted sm:col-start-3 sm:mt-0">{m.blurb}</span>
                </li>
              ))}
            </ol>
            <Link href="/play/whos-the-bot#solo" className="btn btn-brand mt-8 px-7 py-3.5">
              Pick a solo mode
            </Link>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4">
          <p className="crt text-4xl leading-none text-text md:text-6xl">
            <span className="text-brand glow">{">"}</span> think you&apos;d spot it? <span className="text-muted">[Y/n]</span>
            <span className="cursor text-brand" />
          </p>
          <p className="mt-3 text-sm text-muted">Grab two friends. It takes ten seconds to start.</p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link href="/play/whos-the-bot" className="btn btn-brand px-7 py-4">
              Start a game
            </Link>
            <Link href="/lounge" className="btn btn-ghost px-6 py-4">
              Find players
            </Link>
            <a href={ANDROID_APK_URL} className="btn btn-ghost px-6 py-4">
              Android app
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
