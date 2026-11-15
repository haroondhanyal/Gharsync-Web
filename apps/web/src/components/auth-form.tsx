"use client";

import { useState } from "react";
import { Eye, EyeOff, ArrowRight, LoaderCircle } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const isSignup = mode === "signup";
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(isSignup ? "Account creation will be available when secure sign-up is connected." : "Secure sign-in will be available when authentication is connected.");
  }
  return <form className="auth-form" onSubmit={submit}>
    {isSignup && <label>Full name<input name="name" autoComplete="name" placeholder="e.g. Ayesha Khan" required /></label>}
    <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
    <label>Password<span className="password-wrap"><input name="password" type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} placeholder={isSignup ? "At least 8 characters" : "Enter your password"} minLength={8} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
    {mode === "login" && <a className="forgot-link" href="mailto:support@gharsync.com?subject=Password%20reset">Forgot password?</a>}
    {isSignup && <label className="consent"><input type="checkbox" required /><span>I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</span></label>}
    <button className="button button-dark auth-submit" type="submit">{isSignup ? "Create your account" : "Log in to GharSync"}<ArrowRight size={16}/></button>
    {message && <p className="form-message" role="status">{message}</p>}
  </form>;
}
