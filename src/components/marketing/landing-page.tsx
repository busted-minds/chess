import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bolt, CalendarClock, Check, ChevronRight, Flame, Play, Radio, Sparkles, Target, Trophy, Users } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { HeroBoard } from "@/components/marketing/hero-board";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, Pill, Surface } from "@/components/ui/surface";
import { dailyMission, featuredGames, launchTournaments, platformStats, playModes, values } from "@/lib/data/content";

const ticker = ["MiraTempo won in 31 moves", "Pixel Pawn solved today's puzzle", "After Hours Arena starts soon", "Nova Knight is ready for a rematch", "Sage Bishop crossed 2100"];

export function LandingPage() {
  const accentStyles = {
    cyan: { icon: "bg-cyan-400/12 text-cyan-300", glow: "bg-cyan-400/10 group-hover:bg-cyan-400/20", border: "hover:border-cyan-400/40" },
    orange: { icon: "bg-orange-400/12 text-orange-300", glow: "bg-orange-400/10 group-hover:bg-orange-400/20", border: "hover:border-orange-400/40" },
    violet: { icon: "bg-violet-400/12 text-violet-300", glow: "bg-violet-400/10 group-hover:bg-violet-400/20", border: "hover:border-violet-400/40" },
    blue: { icon: "bg-blue-400/12 text-blue-300", glow: "bg-blue-400/10 group-hover:bg-blue-400/20", border: "hover:border-blue-400/40" },
  } as const;
  return (
    <main className="overflow-hidden">
      <section className="relative border-b border-[var(--border)]">
        <div className="grid-glow absolute inset-0 -z-20" />
        <div className="radial-cyan absolute inset-0 -z-10" />
        <div className="mx-auto grid min-h-[760px] max-w-[1320px] items-center gap-12 px-5 py-20 md:px-8 lg:grid-cols-[1fr_.92fr] lg:py-24">
          <div>
            <Pill className="border-cyan-300/20 bg-cyan-400/8 text-cyan-200"><span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />Ready when you are · no account needed</Pill>
            <div className="mt-7 sm:hidden"><BrandLogo className="h-24 w-48" /></div>
            <h1 className="mt-7 max-w-3xl text-[clamp(3rem,7vw,6rem)] font-bold leading-[.92] tracking-[-0.075em]">Busted Minds Chess</h1>
            <p className="mt-5 text-2xl font-bold tracking-[-0.04em] text-gradient sm:text-4xl">Outthink the board.</p>
            <p className="mt-7 max-w-xl text-base leading-7 text-[var(--text-muted)] sm:text-lg sm:leading-8">Busted Minds Chess is a public, browser-based chess application. Its purpose is to let people play chess online against other players, challenge computer opponents, share a local board with a friend, solve puzzles, study openings, analyze positions with in-browser Stockfish, and join chess events.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/play/online" size="lg" className="group"><Bolt size={18} fill="currentColor" />Play online<ArrowRight size={17} className="transition group-hover:translate-x-1" /></ButtonLink>
              <ButtonLink href="/play/ai" size="lg" variant="secondary"><Sparkles size={18} className="text-orange-300" />Challenge the AI</ButtonLink>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[var(--text-faint)]">
              <span className="flex items-center gap-2"><Check size={14} className="text-emerald-400" />Offline modes</span>
              <span className="flex items-center gap-2"><Check size={14} className="text-emerald-400" />Browser Stockfish</span>
              <span className="flex items-center gap-2"><Check size={14} className="text-emerald-400" />Free to start</span>
            </div>
          </div>
          <div className="relative py-5 lg:pl-8"><HeroBoard /></div>
        </div>
        <div className="relative overflow-hidden border-t border-[var(--border)] bg-[var(--surface-deep)] py-3">
          <div className="animate-ticker flex w-max items-center gap-10 whitespace-nowrap pr-10 text-xs font-semibold text-[var(--text-muted)]">{[...ticker, ...ticker].map((item, index) => <span key={`${item}-${index}`} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[var(--accent)]" />{item}</span>)}</div>
        </div>
      </section>

      <section aria-labelledby="about-busted-minds-chess" className="border-b border-[var(--border)] bg-[var(--surface-deep)]">
        <div className="mx-auto grid max-w-[1320px] gap-8 px-5 py-14 md:px-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <Eyebrow>About the application</Eyebrow>
            <h2 id="about-busted-minds-chess" className="mt-3 text-3xl font-bold tracking-[-0.04em]">What is Busted Minds Chess?</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--text-muted)]">Busted Minds Chess provides online multiplayer chess, computer and local play, puzzles, opening study, browser-based game analysis, ratings, game history, social features, and tournaments. Local play and computer games can be used without an account. Creating an account is optional and lets a player keep their identity, games, ratings, friends, events, and learning progress.</p>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-xl font-bold">How Google sign-in is used</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">If you choose Google sign-in, Busted Minds Chess requests only your name, email address, profile image, and Google account identifier. We use this information to create or authenticate your Busted Minds Chess account and associate your saved progress with it. We do not request access to Gmail, Google Drive, Calendar, Contacts, or other Google services.</p>
            <p className="mt-4 text-sm text-[var(--text-muted)]">See our <Link href="/privacy" className="font-bold text-[var(--accent)] hover:underline">Privacy Policy</Link> and <Link href="/terms" className="font-bold text-[var(--accent)] hover:underline">Terms of Service</Link>.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-24 md:px-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><Eyebrow>Four ways into the game</Eyebrow><h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-[-0.05em] sm:text-5xl">Your next board is already waiting.</h2></div>
          <p className="max-w-sm text-sm leading-6 text-[var(--text-muted)]">Start without an account. Sign in whenever you want ratings, history, friends, events, and lasting progress.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {playModes.map((mode, index) => {
            const Icon = mode.icon;
            const accent = accentStyles[mode.accent];
            return <Link href={mode.href} key={mode.id} className={`group relative min-h-[310px] overflow-hidden rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 ${accent.border}`}>
              <div className={`absolute -right-12 -top-12 size-40 rounded-full blur-3xl transition ${accent.glow}`} />
              <div className={`grid size-12 place-items-center rounded-2xl ${accent.icon}`}><Icon size={23} /></div>
              <p className="mt-8 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--text-faint)]">0{index + 1} · {mode.eyebrow}</p>
              <h3 className="mt-2 text-2xl font-bold">{mode.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{mode.description}</p>
              <div className="absolute inset-x-6 bottom-6 flex items-center justify-between"><span className="text-xs font-semibold text-[var(--text-faint)]">{mode.stat}</span><span className="grid size-9 place-items-center rounded-full bg-[var(--surface-raised)] transition group-hover:translate-x-1 group-hover:bg-[var(--accent)] group-hover:text-[#031421]"><ArrowRight size={16} /></span></div>
            </Link>;
          })}
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--surface-deep)]">
        <div className="mx-auto grid max-w-[1320px] gap-5 px-5 py-20 md:px-8 lg:grid-cols-[1.12fr_.88fr]">
          <Surface className="relative overflow-hidden p-7 sm:p-9">
            <div className="absolute right-0 top-0 size-72 bg-[radial-gradient(circle_at_top_right,rgba(255,122,26,.15),transparent_65%)]" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between gap-5"><div><Eyebrow className="text-orange-300">Today&apos;s challenge</Eyebrow><h2 className="mt-3 text-3xl font-bold tracking-[-.04em]">{dailyMission.title}</h2></div><div className="grid size-14 shrink-0 place-items-center rounded-2xl orange-gradient text-[#2b1200] shadow-[0_12px_35px_rgba(255,122,26,.25)]"><Target size={27} /></div></div>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--text-muted)]">{dailyMission.description}</p>
              <div className="my-8 grid min-h-44 place-items-center rounded-2xl border border-dashed border-orange-300/20 bg-orange-400/5">
                <div className="text-center"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-orange-400/10 text-4xl">♜</div><p className="mt-3 text-sm font-bold">White to move</p><p className="mt-1 text-xs text-[var(--text-faint)]">Rated 1520 · 3 move sequence</p></div>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-3"><ButtonLink href="/puzzles" className="bg-orange-500 text-white hover:bg-orange-400"><Play size={16} fill="currentColor" />Solve position</ButtonLink><Pill><Flame size={13} className="text-orange-300" />{dailyMission.streak} day streak</Pill><Pill className="text-emerald-300">{dailyMission.reward}</Pill></div>
            </div>
          </Surface>

          <Surface className="p-6 sm:p-7">
            <div className="flex items-center justify-between"><div><Eyebrow>On the boards</Eyebrow><h2 className="mt-2 text-2xl font-bold">Featured games</h2></div><Radio size={20} className="text-red-400" /></div>
            <div className="mt-5 divide-y divide-[var(--border)]">
              {featuredGames.map((game) => <Link href="/watch" key={`${game.white}-${game.black}`} className="group block py-4 first:pt-1">
                <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-4"><p className="truncate text-sm font-bold">{game.white} <span className="font-normal text-[var(--text-faint)]">{game.whiteRating}</span></p><span className="font-mono text-xs font-bold">{game.result}</span></div><div className="mt-1 flex items-center justify-between gap-4"><p className="truncate text-sm font-bold">{game.black} <span className="font-normal text-[var(--text-faint)]">{game.blackRating}</span></p><span className="text-[10px] text-[var(--text-faint)]">{game.time}</span></div></div><ChevronRight size={17} className="text-[var(--text-faint)] transition group-hover:translate-x-1 group-hover:text-[var(--accent)]" /></div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-[var(--text-faint)]"><span>{game.opening}</span><span className="text-[var(--accent)]">{game.move} · {game.viewers} watching</span></div>
              </Link>)}
            </div>
            <ButtonLink href="/watch" variant="secondary" className="mt-3 w-full">Watch live games</ButtonLink>
          </Surface>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-24 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div><Eyebrow>Built for the quiet launch</Eyebrow><h2 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-5xl">A chess world that never feels empty.</h2><p className="mt-5 text-sm leading-7 text-[var(--text-muted)]">Real opponents when they&apos;re here. Thoughtful computer house players, curated events, daily positions, and active training when they aren&apos;t.</p><ButtonLink href="/features" variant="secondary" className="mt-7">Explore every feature<ArrowRight size={16} /></ButtonLink></div>
          <div className="grid gap-4 sm:grid-cols-3">{values.map(({ icon: Icon, title, body }) => <Surface key={title} className="p-5"><div className="grid size-11 place-items-center rounded-2xl bg-cyan-400/10 text-[var(--accent)]"><Icon size={21} /></div><h3 className="mt-5 text-lg font-bold leading-6">{title}</h3><p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">{body}</p></Surface>)}</div>
        </div>
        <div className="mt-16 grid grid-cols-3 divide-x divide-[var(--border)] rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] py-7">{platformStats.map((stat) => <div key={stat.label} className="px-3 text-center sm:px-6"><p className="text-2xl font-bold tracking-tight text-[var(--accent)] sm:text-4xl">{stat.value}</p><p className="mt-2 text-xs font-bold sm:text-sm">{stat.label}</p><p className="mt-1 hidden text-[10px] text-[var(--text-faint)] sm:block">{stat.detail}</p></div>)}</div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--surface-deep)]">
        <div className="mx-auto max-w-[1320px] px-5 py-20 md:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><Eyebrow>Upcoming competition</Eyebrow><h2 className="mt-3 text-4xl font-bold tracking-[-.05em]">Pick your arena.</h2></div><ButtonLink href="/tournaments" variant="ghost">All tournaments<ArrowRight size={16} /></ButtonLink></div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">{launchTournaments.map((event) => <Surface key={event.id} className="group p-6 transition hover:-translate-y-1 hover:border-[var(--border-strong)]"><div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-2xl" style={{ backgroundColor: `${event.color}1b`, color: event.color }}><Trophy size={21} /></span><Pill>{event.format}</Pill></div><h3 className="mt-6 text-xl font-bold">{event.name}</h3><div className="mt-5 grid grid-cols-2 gap-3 text-xs text-[var(--text-muted)]"><span className="flex items-center gap-2"><CalendarClock size={14} />{event.starts}</span><span className="flex items-center gap-2"><Bolt size={14} />{event.clock}</span><span className="flex items-center gap-2"><Users size={14} />{event.players}/{event.cap}</span><span className="truncate font-semibold text-[var(--text)]">{event.prize}</span></div><Link href={`/tournaments/${event.id}`} className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-4 text-sm font-bold text-[var(--accent)]">View event<ArrowRight size={16} className="transition group-hover:translate-x-1" /></Link></Surface>)}</div>
        </div>
      </section>

      <section className="relative overflow-hidden px-5 py-28 text-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(25,198,237,.14),transparent_52%)]" />
        <Image src="/mascot/nova.png" alt="Nova, the Busted Minds Chess mascot" width={260} height={390} className="pointer-events-none absolute -bottom-16 left-[max(1rem,calc(50%-600px))] hidden h-80 w-auto object-contain opacity-90 lg:block" />
        <Image src="/brand/chess-logo.png" alt="Busted Minds Chess" width={280} height={186} className="dark-logo mx-auto h-32 w-52 object-contain" />
        <Image src="/brand/chess-logo.png" alt="Busted Minds Chess" width={280} height={186} className="light-logo mx-auto h-32 w-52 object-contain" />
        <h2 className="mx-auto mt-2 max-w-3xl text-4xl font-bold tracking-[-.055em] sm:text-6xl">The board is ready.<br /><span className="text-gradient">What&apos;s your idea?</span></h2>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--text-muted)]">Take a seat in seconds. Keep your history when you&apos;re ready to make it yours.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><ButtonLink href="/play/online" size="lg"><Bolt size={18} />Find a game</ButtonLink><ButtonLink href="/auth" variant="secondary" size="lg">Create free account</ButtonLink></div>
      </section>
      <SiteFooter />
    </main>
  );
}
