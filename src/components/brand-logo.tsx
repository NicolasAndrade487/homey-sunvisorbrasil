type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export function BrandLogo({ className = "", alt = "SVB Sun Visor Brasil" }: BrandLogoProps) {
  const classes = [
    "h-auto",
    "w-auto",
    "max-h-[72px]",
    "max-w-[220px]",
    "object-contain",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <img src="/svb-logo.png" alt={alt} className={classes} draggable={false} />;
}
