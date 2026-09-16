import svbLogo from "@/assets/svb-logo.png";

type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export function BrandLogo({ className = "", alt = "SVB Sun Visor Brasil" }: BrandLogoProps) {
<<<<<<< HEAD
  return <img src={svbLogo} alt={alt} className={className} draggable={false} />;
=======
  return <img src={svbLogo} alt={alt} className={className} />;
>>>>>>> 7b24a89a4c229ba1957eb88d58e780c3f39c9e6a
}
