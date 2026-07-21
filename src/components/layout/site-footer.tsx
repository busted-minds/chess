import Image from "next/image";
import Link from "next/link";

const groups = [
  { title: "Chess", links: [["Play", "/play"], ["Puzzles", "/puzzles"], ["Openings", "/openings"], ["Tournaments", "/tournaments"]] },
  { title: "Community", links: [["Players", "/community"], ["Clubs", "/clubs"], ["Leaderboards", "/leaderboard"], ["Guidelines", "/guidelines"]] },
  { title: "About", links: [["Features", "/features"], ["How to play", "/how-to-play"], ["Changelog", "/changelog"], ["Contact", "/contact"]] },
  { title: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"], ["Licenses", "/licenses"], ["Status", "/api/health"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface-deep)]">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-14 md:grid-cols-[1.3fr_2fr] md:px-8">
        <div>
          <p className="max-w-sm text-sm leading-6 text-[var(--text-muted)]">A thoughtful chess home for the games you play now and the player you are becoming.</p>
          <div className="mt-6 flex items-center gap-3"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)]">Powered by</span><a href="https://bustedminds.us.kg" target="_blank" rel="noopener noreferrer" className="rounded-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"><Image src="/brand/busted-minds.png" alt="Busted Minds" width={115} height={48} className="h-9 w-auto object-contain" /></a></div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {groups.map((group) => <div key={group.title}><p className="text-sm font-bold">{group.title}</p><ul className="mt-4 space-y-2.5">{group.links.map(([label, href]) => <li key={href}><Link href={href} className="text-sm text-[var(--text-muted)] transition hover:text-[var(--accent)]">{label}</Link></li>)}</ul></div>)}
        </div>
      </div>
      <div className="border-t border-[var(--border)] px-5 py-5 text-center text-xs text-[var(--text-faint)]">© {new Date().getFullYear()} Busted Minds Chess. Make your next move count.</div>
    </footer>
  );
}
