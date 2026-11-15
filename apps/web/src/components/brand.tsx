import { House, Sparkles } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return <a className={`brand ${light ? "brand-light" : ""}`} href="/" aria-label="GharSync home">
    <span className="brand-mark"><House size={19} strokeWidth={2.2} /><Sparkles className="brand-spark" size={9} /></span>
    <span>ghar<span className="brand-accent">sync</span></span>
  </a>;
}
