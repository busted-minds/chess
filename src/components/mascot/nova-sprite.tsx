import { cn } from "@/lib/utils";

const positions = {
  wave: "0% 0%",
  think: "100% 0%",
  celebrate: "0% 100%",
  puzzled: "100% 100%",
} as const;

export function NovaSprite({ pose = "wave", className, label = "Nova, the Busted Minds Chess mascot" }: { pose?: keyof typeof positions; className?: string; label?: string }) {
  return <span role="img" aria-label={label} className={cn("block bg-[url('/mascot/nova-sprites.png')] bg-[length:200%_200%] bg-no-repeat", className)} style={{ backgroundPosition: positions[pose] }} />;
}
