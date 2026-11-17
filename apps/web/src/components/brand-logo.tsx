import Image from "next/image";
import { BRAND } from "@/lib/brand";
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
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-12 w-12"
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
        alt={BRAND.name}
        className={cn("shrink-0 object-contain", imageSizes[variant], imageClassName)}
        height={96}
        priority
        src={BRAND.assets.symbol}
        width={96}
      />
      {showText ? (
        <div className="min-w-0">
          <p className={cn("truncate text-base font-semibold leading-none tracking-tight", textClassName)}>{BRAND.name}</p>
          <p className={cn("mt-1 truncate text-xs text-muted-foreground", subtitleClassName)}>{BRAND.tagline}</p>
        </div>
      ) : null}
    </div>
  );
}
