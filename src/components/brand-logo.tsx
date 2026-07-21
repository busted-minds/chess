import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={cn("relative block overflow-hidden", className)}>
      <Image src="/brand/chess-logo-dark.png" alt="Busted Minds Chess" fill sizes="240px" priority={priority} className="object-contain dark-logo" />
      <Image src="/brand/chess-logo-light.png" alt="Busted Minds Chess" fill sizes="240px" priority={priority} className="object-contain light-logo" />
    </span>
  );
}
