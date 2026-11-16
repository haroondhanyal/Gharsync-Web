"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarCheck2, Check, ChevronLeft, ChevronRight, House, ShieldCheck, Sparkles, UsersRound, Wrench } from "lucide-react";

type PromoKind = "login" | "signup" | "recovery";

const campaigns: Record<PromoKind, { eyebrow: string; title: string; copy: string; icon: typeof House; label: string }[]> = {
  login: [
    { eyebrow: "HOME, IN GOOD HANDS", title: "Care for every corner of home.", copy: "Keep properties, appliances and service history together in one calm workspace.", icon: House, label: "Home passports" },
    { eyebrow: "LESS CHASING, MORE CARING", title: "A clearer day for your team.", copy: "Bring customer requests, bookings and technician schedules into sync.", icon: CalendarCheck2, label: "Bookings in sync" },
    { eyebrow: "PEOPLE YOU CAN COUNT ON", title: "Give every visit a familiar face.", copy: "Keep trusted technicians, their skills and their availability close at hand.", icon: UsersRound, label: "Trusted teams" },
    { eyebrow: "THE DETAILS, LOOKED AFTER", title: "Know what needs attention.", copy: "Track parts, warranties and follow-ups before small issues grow.", icon: Wrench, label: "Helpful reminders" },
    { eyebrow: "A LITTLE MORE PEACE OF MIND", title: "Good service, all in one place.", copy: "Keep the people, plans and little details of home care together.", icon: ShieldCheck, label: "Your GharSync home" },
  ],
  signup: [
    { eyebrow: "GROW WITH A LITTLE MORE CLARITY", title: "Start with your service business.", copy: "Set up your workspace and bring customers, homes and service requests together.", icon: House, label: "One home for your work" },
    { eyebrow: "MAKE EVERY BOOKING FEEL SIMPLE", title: "From first request to visit.", copy: "Organize quotes, schedules and updates in one easy-to-follow flow.", icon: CalendarCheck2, label: "Smoother service" },
    { eyebrow: "YOUR TEAM, WORKING TOGETHER", title: "Give good people room to shine.", copy: "Invite your staff and keep branch teams and technician schedules aligned.", icon: UsersRound, label: "A team in sync" },
    { eyebrow: "KEEP THE SMALL DETAILS CLOSE", title: "Parts and warranties, remembered.", copy: "Track stock, equipment and follow-ups without scattered notes.", icon: Wrench, label: "Ready for the next job" },
    { eyebrow: "YOUR NEXT CHAPTER STARTS HERE", title: "Make home care feel more in sync.", copy: "Create your workspace and get a 14-day Free trial to explore GharSync.", icon: Sparkles, label: "Start your free trial" },
  ],
  recovery: [
    { eyebrow: "YOUR ACCOUNT, KEPT SAFE", title: "A secure reset, sent with care.", copy: "We only show the same confirmation either way, so account details stay private.", icon: ShieldCheck, label: "Privacy comes first" },
    { eyebrow: "BACK TO THE IMPORTANT THINGS", title: "Your service history stays put.", copy: "Your homes, requests and team details remain right where you left them.", icon: House, label: "Your workspace is safe" },
    { eyebrow: "ONE LESS THING TO WORRY ABOUT", title: "A fresh link gets you moving.", copy: "Use the reset link once and choose a new password for your account.", icon: ArrowRight, label: "A simple next step" },
    { eyebrow: "CARE THAT KEEPS MOVING", title: "Bookings and visits are still in sync.", copy: "Your team can keep serving customers while you recover access.", icon: CalendarCheck2, label: "Work carries on" },
    { eyebrow: "WE’LL BE HERE WHEN YOU’RE READY", title: "Return to GharSync with confidence.", copy: "Set a strong password and get back to the people and work you care for.", icon: Check, label: "Welcome back soon" },
  ],
};

export function AuthPromoCarousel({ kind }: { kind: PromoKind }) {
  const slides = campaigns[kind];
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = slides[active]!;
  const Icon = slide.icon;

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  function move(direction: number) {
    setActive((current) => (current + direction + slides.length) % slides.length);
  }

  return <aside className="auth-aside auth-promo" aria-label="GharSync highlights" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}>
    <div className="aside-top"><span><Sparkles size={15}/>{slide.eyebrow}</span><span>{String(active + 1).padStart(2, "0")} <i/> 05</span></div>
    <div className="aside-art" aria-hidden="true">
      <div className="aside-sun"/><div className="aside-home"><div className="aside-roof"/><div className="aside-house"><i/><b/><i/></div></div>
      <div className="aside-leaf leaf-a"/><div className="aside-leaf leaf-b"/>
      <div className="aside-note"><span className="note-check"><Icon size={15}/></span><div><b>{slide.label}</b><small>One thoughtful workspace</small></div></div>
    </div>
    <div className="promo-copy" key={active}><span className="quote-mark">“</span><h2>{slide.title}</h2><p>{slide.copy}</p><span className="promo-tag">GHARSYNC HOME CARE</span></div>
    <div className="promo-controls" aria-label="Promotional slides">
      <button type="button" aria-label="Previous slide" onClick={() => move(-1)}><ChevronLeft size={15}/></button>
      <div className="aside-pagination">{slides.map((item, index) => <button key={item.eyebrow} type="button" className={index === active ? "active" : ""} aria-label={`Show slide ${index + 1}`} aria-current={index === active ? "true" : undefined} onClick={() => setActive(index)}/>)}</div>
      <button type="button" aria-label="Next slide" onClick={() => move(1)}><ChevronRight size={15}/></button>
    </div>
    <span className="promo-pause"><ArrowLeft size={10}/> New highlight every 6.5 seconds <ArrowRight size={10}/></span>
  </aside>;
}
