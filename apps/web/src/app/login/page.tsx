import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";
import { AuthPromoCarousel } from "@/components/auth-promo-carousel";
import { AuthSplash } from "@/components/auth-splash";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const nextPath = (await searchParams).next;
  const redirectTo = nextPath?.startsWith("/") && !nextPath.startsWith("//") && !nextPath.includes("\\") ? nextPath : undefined;
  return <main className="auth-layout"><AuthSplash/><section className="auth-form-side"><Brand /><Link className="back-link" href="/"><ArrowLeft size={15} /> Back to home</Link><div className="auth-content"><div className="eyebrow">WELCOME BACK</div><h1>Good to see<br />you <span className="serif-accent">again.</span></h1><p className="auth-intro">Your home and all its little to-dos are right where you left them.</p><AuthForm mode="login" redirectTo={redirectTo}/><p className="auth-switch">New to GharSync? <Link href="/signup">Create an account <ArrowRight size={14} /></Link></p><div className="secure-note"><ShieldCheck size={14} /> Your information stays private and secure</div></div><div className="auth-bottom">© 2026 GharSync <span>·</span> Made for home</div></section><AuthPromoCarousel kind="login"/></main>;
}
