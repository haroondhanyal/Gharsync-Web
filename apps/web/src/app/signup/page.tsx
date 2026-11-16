import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";
import { AuthPromoCarousel } from "@/components/auth-promo-carousel";
import { AuthSplash } from "@/components/auth-splash";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ inviteToken?: string }> }) {
  const { inviteToken } = await searchParams;
  const joining = Boolean(inviteToken);
  return <main className="auth-layout"><AuthSplash/><section className="auth-form-side"><Brand /><Link className="back-link" href="/"><ArrowLeft size={15} /> Back to home</Link><div className="auth-content signup-content"><div className="eyebrow">{joining ? "YOUR TEAM IS WAITING" : "A BETTER WAY TO HOME"}</div><h1>{joining ? <>Join your<br /><span className="serif-accent">GharSync team.</span></> : <>Make home feel<br /><span className="serif-accent">more in sync.</span></>}</h1><p className="auth-intro">{joining ? "Create your account with the email address this invitation was sent to. We'll verify your phone before you join." : "One simple account for the people, services and little details that keep life running."}</p><AuthForm mode="signup" inviteToken={inviteToken} /><p className="auth-switch">Already have an account? <Link href="/login">Log in <ArrowRight size={14} /></Link></p><div className="secure-note"><ShieldCheck size={14} /> Your information stays private and secure</div></div><div className="auth-bottom">© 2026 GharSync <span>·</span> Made for home</div></section><AuthPromoCarousel kind="signup"/></main>;
}
