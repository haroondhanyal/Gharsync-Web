"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, LoaderCircle } from "lucide-react";

type AuthMode = "login" | "signup";
type AccountType = "business" | "team";

function errorMessage(body: unknown) {
  if (typeof body === "object" && body && "message" in body) {
    const message = (body as { message?: unknown }).message;
    return Array.isArray(message) ? message.join(" ") : String(message);
  }
  return "Something went wrong. Please try again.";
}

export function AuthForm({ mode, inviteToken }: { mode: AuthMode; inviteToken?: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const accountType: AccountType = inviteToken ? "team" : "business";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const body = isSignup
      ? {
          accountType,
          fullName: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          phone: String(data.get("phone") ?? ""),
          password: String(data.get("password") ?? ""),
          ...(accountType === "business" ? {
            organizationName: String(data.get("organizationName") ?? ""),
            businessType: String(data.get("businessType") ?? "OTHER"),
            city: String(data.get("city") ?? ""),
          } : {}),
        }
      : { email: String(data.get("email") ?? ""), password: String(data.get("password") ?? "") };
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}/auth/${isSignup ? "register" : "sign-in"}`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(result));
      if (isSignup && inviteToken) {
        router.push(`/verify-phone?token=${encodeURIComponent(inviteToken)}`);
      } else if (result.phoneVerificationRequired) {
        router.push("/verify-phone");
      } else if (result.user?.memberships?.length === 0) {
        router.push("/onboarding");
      } else {
        window.location.assign("/dashboard");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GharSync could not reach the API. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="auth-form" onSubmit={submit}>
    {isSignup && <>
      {!inviteToken && <div className="account-type-choice" aria-label="Account type"><span className="selected">Service business</span><span>Team members join with an invitation</span></div>}
      <label>Full name<input name="name" autoComplete="name" placeholder="e.g. Ayesha Khan" minLength={2} maxLength={160} required /></label>
      <label>Phone number<input name="phone" type="tel" autoComplete="tel" placeholder="03XXXXXXXXX" pattern="(\+92|0092|0)3[0-9]{9}" title="Enter a Pakistan mobile number, such as 03XXXXXXXXX" required /></label>
      {accountType === "business" && <>
        <label>Business name<input name="organizationName" autoComplete="organization" placeholder="e.g. Lahore Home Care" minLength={2} maxLength={180} required /></label>
        <div className="form-row">
          <label>Service type<select name="businessType" defaultValue="AC_REPAIR"><option value="AC_REPAIR">AC repair</option><option value="ELECTRICAL">Electrical</option><option value="PLUMBING">Plumbing</option><option value="APPLIANCE_REPAIR">Appliance repair</option><option value="SOLAR">Solar care</option><option value="GENERAL_MAINTENANCE">Home maintenance</option><option value="OTHER">Other</option></select></label>
          <label>City<input name="city" placeholder="e.g. Lahore" minLength={2} maxLength={100} required /></label>
        </div>
      </>}
    </>}
    <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={320} required /></label>
    <label>Password<span className="password-wrap"><input name="password" type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} placeholder={isSignup ? "At least 12 characters" : "Enter your password"} minLength={isSignup ? 12 : 1} maxLength={128} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
    {!isSignup && <a className="forgot-link" href="/forgot-password">Forgot password?</a>}
    {isSignup && <label className="consent"><input type="checkbox" required /><span>I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</span></label>}
    <button className="button button-dark auth-submit" type="submit" disabled={busy}>{busy ? <>Please wait <LoaderCircle size={16} className="spin" /></> : <>{isSignup ? "Create your account" : "Log in to GharSync"}<ArrowRight size={16}/></>}</button>
    {message && <p className="form-message" role="alert">{message}</p>}
    {isSignup && <p className="auth-form-footnote">Phone verification uses an SMS provider configured by your platform administrator.</p>}
  </form>;
}
