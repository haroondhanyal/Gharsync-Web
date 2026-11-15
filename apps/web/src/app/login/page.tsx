import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const nextPath = (await searchParams).next;
  const redirectTo = nextPath?.startsWith("/") && !nextPath.startsWith("//") && !nextPath.includes("\\") ? nextPath : undefined;
  return <main className="auth-layout"><section className="auth-form-side"><Brand /><Link className="back-link" href="/"><ArrowLeft size={15} /> Back to home</Link><div className="auth-content"><div className="eyebrow">WELCOME BACK</div><h1>Good to see<br />you <span className="serif-accent">again.</span></h1><p className="auth-intro">Your home and all its little to-dos are right where you left them.</p><AuthForm mode="login" redirectTo={redirectTo}/><p className="auth-switch">New to GharSync? <Link href="/signup">Create an account <ArrowRight size={14} /></Link></p><div className="secure-note"><ShieldCheck size={14} /> Your information stays private and secure</div></div><div className="auth-bottom">© 2026 GharSync <span>·</span> Made for home</div></section>
    <aside className="auth-aside"><div className="aside-top"><span><Sparkles size={15} /> HOME, IN GOOD HANDS</span><span>01 <i /> 03</span></div><div className="aside-art"><div className="aside-sun"/><div className="aside-home"><div className="aside-roof"/><div className="aside-house"><i/><b/><i/></div></div><div className="aside-leaf leaf-a"/><div className="aside-leaf leaf-b"/><div className="aside-note"><span className="note-check"><Check size={15}/></span><div><b>One less thing to worry about.</b><small>Home care, all in one place.</small></div></div></div><div className="aside-quote"><div className="quote-mark">“</div><blockquote>A little more care for the place that means the most.</blockquote><p>GHARSYNC HOME</p></div><div className="aside-pagination"><i className="active"/><i/><i/></div></aside></main>;
}
