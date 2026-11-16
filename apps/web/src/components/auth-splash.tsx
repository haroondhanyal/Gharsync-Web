"use client";

import { useEffect, useState } from "react";
import { House, Sparkles } from "lucide-react";

export function AuthSplash() {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const hold = window.setTimeout(() => setVisible(false), 650);
    const remove = window.setTimeout(() => setMounted(false), 1050);
    return () => { window.clearTimeout(hold); window.clearTimeout(remove); };
  }, []);

  if (!mounted) return null;
  return <div className={`auth-splash${visible ? "" : " is-leaving"}`} aria-hidden="true">
    <div className="auth-splash-brand"><span className="brand-mark"><House size={20}/><Sparkles className="brand-spark" size={9}/></span><span>ghar<span>sync</span></span></div>
    <p>HOME, IN GOOD HANDS</p>
    <span className="auth-splash-progress"/>
  </div>;
}
