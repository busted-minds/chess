import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { InviteAcceptor } from "@/components/chess/invite-acceptor";
import { InviteBuilder } from "@/components/chess/invite-builder";

export const metadata: Metadata = { title: "Invite a friend" };

type InvitePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const query = await searchParams;
  const gameId = first(query.gameId);
  const token = first(query.token);
  const isInviteLink = gameId !== undefined || token !== undefined;

  return (
    <AppShell
      title={isInviteLink ? "Private challenge" : "Invite a friend"}
      description={isInviteLink
        ? "Accept the invitation, then meet your opponent on the live board."
        : "Choose the rules, create a private link, and bring exactly the opponent you want."}
    >
      {isInviteLink
        ? <InviteAcceptor gameId={gameId ?? ""} inviteToken={token ?? ""} />
        : <InviteBuilder />}
    </AppShell>
  );
}
