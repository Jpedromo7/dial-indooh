import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
  subtitleClassName?: string;
  textClassName?: string;
  variant?: "sm" | "md" | "lg";
}

const imageSizes = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-14 w-14"
};

export function BrandLogo({
  className,
  imageClassName,
  showText = true,
  subtitleClassName,
  textClassName,
  variant = "md"
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Image
        alt="Dial Indooh"
        className={cn("shrink-0 rounded-md bg-black object-contain", imageSizes[variant], imageClassName)}
        height={96}
        priority
        src="/brand/dial-indooh-logo.png"
        width={96}
      />
      {showText ? (
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-semibold leading-none", textClassName)}>Dial Indooh</p>
          <p className={cn("mt-1 truncate text-xs text-muted-foreground", subtitleClassName)}>Signage control</p>
        </div>
      ) : null}
    </div>
  );
}
