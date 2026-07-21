"use client";

import { useState } from "react";
import { Activity, Radio, Sparkles } from "lucide-react";

const position = [
  "", "", "♜", "♛", "", "♜", "♚", "",
  "♟", "♟", "", "♝", "", "♟", "♟", "♟",
  "", "", "♞", "♟", "", "♞", "", "",
  "", "", "", "", "♟", "", "", "",
  "", "", "♗", "", "♙", "", "", "",
  "", "", "♘", "♙", "", "♘", "", "",
  "♙", "♙", "", "", "", "♙", "♙", "♙",
  "♖", "", "♗", "♕", "♖", "", "♔", "",
];

export function HeroBoard() {
  const [active, setActive] = useState(36);
  return (
    <div className="relative mx-auto w-full max-w-[560px] animate-float">
      <div className="absolute -inset-10 -z-10 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="shine-border rounded-[1.8rem] bg-[var(--surface)] p-3 shadow-[0_35px_100px_rgba(0,0,0,.42)] sm:p-4">
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-[var(--surface-soft)] px-3 py-2.5">
          <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-violet-400/15 text-lg">♝</span><div><p className="text-xs font-bold">Sage Bishop <span className="ml-1 text-[10px] font-medium text-violet-300">2190</span></p><p className="text-[10px] text-[var(--text-faint)]">House Player · thinking</p></div></div>
          <span className="rounded-lg bg-[var(--surface-deep)] px-3 py-1.5 font-mono text-sm font-bold tracking-wide">02:18</span>
        </div>
        <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-xl border border-white/10 shadow-inner" role="img" aria-label="A live chess position between MiraTempo and Sage Bishop">
          {position.map((piece, index) => {
            const row = Math.floor(index / 8);
            const col = index % 8;
            const light = (row + col) % 2 === 0;
            const isActive = index === active || index === 19;
            return <button key={index} aria-label={`${String.fromCharCode(97 + col)}${8 - row}${piece ? ` ${piece}` : " empty"}`} onClick={() => setActive(index)} className={`relative grid place-items-center text-[clamp(1.35rem,5.2vw,3rem)] leading-none transition hover:brightness-110 ${light ? "bg-[#c5d9df]" : "bg-[#3b7183]"} ${isActive ? "after:absolute after:inset-0 after:bg-yellow-300/30" : ""}`}><span className={`relative z-10 drop-shadow-[0_2px_1px_rgba(0,0,0,.3)] ${piece && piece.charCodeAt(0) >= 9818 ? "text-[#0c1721]" : "text-[#f9fbfc]"}`}>{piece}</span></button>;
          })}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-[var(--surface-soft)] px-3 py-2.5">
          <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-cyan-400/15 text-lg">♞</span><div><p className="text-xs font-bold">MiraTempo <span className="ml-1 text-[10px] font-medium text-cyan-300">2284</span></p><p className="text-[10px] text-[var(--text-faint)]">7 game streak</p></div></div>
          <span className="rounded-lg bg-cyan-400 px-3 py-1.5 font-mono text-sm font-black tracking-wide text-[#031421]">01:46</span>
        </div>
      </div>
      <div className="absolute -right-2 top-[12%] hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur md:flex"><Radio size={13} className="text-red-400" />18 watching</div>
      <div className="absolute -left-6 bottom-[18%] hidden rounded-2xl border border-orange-300/20 bg-[#1a1b24]/95 p-3 shadow-xl backdrop-blur sm:block"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-orange-400/15"><Sparkles size={15} className="text-orange-300" /></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-orange-300">Tactic found</p><p className="text-xs font-semibold">26. Rxd7!</p></div></div></div>
      <div className="absolute -bottom-3 right-8 hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold shadow-xl sm:flex"><Activity size={14} className="text-emerald-400" />+21 rating</div>
    </div>
  );
}
