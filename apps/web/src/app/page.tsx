import Link from "next/link";
import { ArrowRight, Check, ChevronRight, CircleCheck, Clock3, ShieldCheck, Wrench, Zap } from "lucide-react";
import { Brand } from "@/components/brand";

const services = ["AC & HVAC", "Electrical", "Plumbing", "Appliances", "Solar care", "Home maintenance"];

export default function HomePage() {
  return <main className="marketing-page">
    <header className="site-nav wrap">
      <Brand />
      <nav className="desktop-nav"><a href="#how">How it works</a><a href="#services">Services</a><a href="#business">For businesses</a></nav>
      <div className="nav-actions"><Link className="nav-login" href="/login">Log in</Link><Link className="button button-dark button-small" href="/signup">Get started <ArrowRight size={15} /></Link></div>
    </header>

    <section className="hero wrap">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-dot" /> Home care, finally in sync</div>
        <h1>Your home.<br />Handled <span className="serif-accent">beautifully.</span></h1>
        <p className="hero-sub">From the first service request to the final fix, keep every home, job and trusted professional in one calm place.</p>
        <div className="hero-buttons"><Link className="button button-dark" href="/signup">Create your free account <ArrowRight size={16} /></Link><a className="text-link" href="#how">See how it works <ChevronRight size={15} /></a></div>
        <div className="hero-proof"><div className="proof-avatars"><span>F</span><span>A</span><span>M</span><span>+</span></div><div><div className="stars">★★★★★ <b>4.9</b></div><small>Trusted by homes and local pros</small></div></div>
      </div>
      <div className="hero-art" aria-label="Illustration of a well cared for home">
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <div className="sun-disc" />
        <div className="house-illustration"><div className="roof" /><div className="house-body"><div className="house-window window-left" /><div className="house-door" /><div className="house-window window-right" /><div className="house-step" /></div><div className="chimney" /></div>
        <div className="plant plant-left"><i /><i /><i /><b /></div><div className="plant plant-right"><i /><i /><i /><b /></div>
        <div className="float-card service-card"><span className="float-icon"><Wrench size={16} /></span><span><b>AC service</b><small>Completed today</small></span><CircleCheck size={17} className="float-check" /></div>
        <div className="float-card care-card"><span className="care-icon"><ShieldCheck size={17} /></span><span><b>Home, in good hands</b><small>All your services, together</small></span></div>
        <div className="art-caption"><span>01 / 03</span><span className="caption-rule" /><span>Thoughtful home care</span></div>
      </div>
    </section>

    <section className="trust-strip"><div className="wrap trust-inner"><span>MADE FOR THE WAY WE LIVE</span><div><Check size={14} /> Local professionals</div><div><Check size={14} /> One home, one history</div><div><Check size={14} /> Service you can follow</div></div></section>

    <section className="services-section wrap" id="services"><div className="section-heading"><div><div className="eyebrow">A little help goes a long way</div><h2>Every home thing,<br /><span className="serif-accent">in one place.</span></h2></div><p>Find the right people, keep the details close, and know what is happening at every step.</p></div>
      <div className="service-grid">{services.map((service, i) => <div className="service-tile" key={service}><span className="service-number">0{i + 1}</span><span>{service}</span><ArrowRight size={16} /></div>)}</div>
    </section>

    <section className="how-section" id="how"><div className="wrap how-inner"><div><div className="eyebrow eyebrow-light">Less chasing. More peace of mind.</div><h2>Good home care<br />should feel <em>easy.</em></h2><p>Whether you are caring for a home or running a service team, GharSync keeps everyone on the same page.</p><Link className="button button-light" href="/signup">See what fits you <ArrowRight size={16} /></Link></div><div className="how-steps"><div className="how-step"><span>01</span><div><b>Tell us what you need</b><small>Share the job, your home and a time that works.</small></div><Clock3 size={18} /></div><div className="how-step"><span>02</span><div><b>Stay in the loop</b><small>Know who is coming and what happens next.</small></div><Zap size={18} /></div><div className="how-step"><span>03</span><div><b>Keep your home history</b><small>Every visit, asset and warranty, easy to find.</small></div><ShieldCheck size={18} /></div></div></div></section>

    <section className="business-cta wrap" id="business"><div><div className="eyebrow">For service businesses</div><h2>Run your service business<br />with room to <span className="serif-accent">grow.</span></h2><p>Bookings, customers, technicians and invoices — a clearer way to run the day.</p></div><Link className="button button-dark" href="/signup?type=business">Explore GharSync Business <ArrowRight size={16} /></Link></section>
    <footer className="site-footer wrap"><Brand /><span>© 2026 GharSync. Your home, in good hands.</span><div><Link href="/login">Log in</Link><Link href="/signup">Get started</Link></div></footer>
  </main>;
}
