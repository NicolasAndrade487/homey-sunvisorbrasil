import svbLogo from "@/assets/svb-logo.png";

type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export function BrandLogo({ className = "", alt = "SVB Sun Visor Brasil" }: BrandLogoProps) {
  return <img src={svbLogo} alt={alt} className={className} />;
}
