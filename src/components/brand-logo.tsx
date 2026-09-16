type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export function BrandLogo({ className = "", alt = "SVB Sun Visor Brasil" }: BrandLogoProps) {
  return (
    <span aria-label={alt} className={`font-display text-4xl font-bold tracking-wide ${className}`}>
      SVB
    </span>
  );
}
