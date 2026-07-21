import { WifiOff } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function OfflinePage() {
  return <main className="grid min-h-[calc(100vh-72px)] place-items-center px-5"><div className="max-w-md text-center"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-cyan-400/10 text-[var(--accent)]"><WifiOff size={30} /></div><h1 className="mt-6 text-4xl font-bold">You&apos;re offline.</h1><p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">Online rooms can wait. Local hotseat and Vs AI stay ready once their assets have loaded.</p><div className="mt-7 flex justify-center gap-3"><ButtonLink href="/play/local">Play local</ButtonLink><ButtonLink href="/play/ai" variant="secondary">Vs AI</ButtonLink></div></div></main>;
}
