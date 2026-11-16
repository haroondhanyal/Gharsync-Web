"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, LoaderCircle, Wind, Zap, Droplets, Refrigerator, Sun, House, Wrench, ChevronDown } from "lucide-react";
import { countries } from "@/lib/locations";
import { phoneCountryDetails } from "@/lib/phone-country";
import { CityAutocomplete } from "@/components/city-autocomplete";

type AuthMode = "login" | "signup";
type AccountType = "business" | "team";

const serviceTypes = [
  { value: "AC_REPAIR", label: "AC repair", icon: Wind },
  { value: "ELECTRICAL", label: "Electrical", icon: Zap },
  { value: "PLUMBING", label: "Plumbing", icon: Droplets },
  { value: "APPLIANCE_REPAIR", label: "Appliance repair", icon: Refrigerator },
  { value: "SOLAR", label: "Solar care", icon: Sun },
  { value: "GENERAL_MAINTENANCE", label: "Home maintenance", icon: House },
  { value: "OTHER", label: "Other services", icon: Wrench },
] as const;

function errorMessage(body: unknown) {
  if (typeof body === "object" && body && "message" in body) {
    const message = (body as { message?: unknown }).message;
    return Array.isArray(message) ? message.join(" ") : String(message);
  }
  return "Something went wrong. Please try again.";
}

export function AuthForm({ mode, inviteToken, redirectTo }: { mode: AuthMode; inviteToken?: string; redirectTo?: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const accountType: AccountType = inviteToken ? "team" : "business";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [businessType, setBusinessType] = useState<(typeof serviceTypes)[number]["value"]>("AC_REPAIR");
  const [countryCode, setCountryCode] = useState("PK");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const isSignup = mode === "signup";
  const service = serviceTypes.find((item) => item.value === businessType) ?? serviceTypes[0];
  const ServiceIcon = service.icon;
  const phoneCountry = countries.find((item) => item.code === countryCode) ?? countries[0]!;
  const phoneDetails = useMemo(() => phoneCountryDetails(countryCode), [countryCode]);
  const minPhoneDigits = phoneDetails.allowedLengths.length ? Math.min(...phoneDetails.allowedLengths) : undefined;
  const maxPhoneDigits = phoneDetails.allowedLengths.length ? Math.max(...phoneDetails.allowedLengths) : 15;
  const phoneLengthPattern = phoneDetails.allowedLengths.length
    ? `(?:${phoneDetails.allowedLengths.map((length) => `\\d{${length}}`).join("|")})`
    : "\\+[1-9]\\d{7,14}";
  const phoneNumberE164 = phoneDetails.callingCode
    ? `${phoneDetails.callingCode}${phoneNumber.replace(/\D/g, "")}`
    : phoneNumber.replace(/[^\d+]/g, "");

  useEffect(() => {
    let current = true;
    setCitySuggestions([]);
    if (!isSignup || accountType !== "business") {
      setCitiesLoading(false);
      return () => { current = false; };
    }
    setCitiesLoading(true);
    fetch(`/data/cities/${countryCode}.json`, { cache: "force-cache" })
      .then((response) => response.ok ? response.json() : [])
      .then((data: unknown) => { if (current) setCitySuggestions(Array.isArray(data) ? data.filter((city): city is string => typeof city === "string") : []); })
      .catch(() => { if (current) setCitySuggestions([]); })
      .finally(() => { if (current) setCitiesLoading(false); });
    return () => { current = false; };
  }, [accountType, countryCode, isSignup]);

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
          phone: phoneNumberE164,
          password: String(data.get("password") ?? ""),
          ...(accountType === "business" ? {
            organizationName: String(data.get("organizationName") ?? ""),
            businessType: String(data.get("businessType") ?? "OTHER"),
            city: String(data.get("city") ?? ""),
            countryCode,
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
        router.push(redirectTo ? `/verify-phone?next=${encodeURIComponent(redirectTo)}` : "/verify-phone");
      } else if (result.user?.memberships?.length === 0) {
        router.push("/onboarding");
      } else {
        window.location.assign(redirectTo ?? "/dashboard");
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
      <label className="phone-field">Mobile number<div className="phone-entry"><div className="phone-country-picker"><select value={countryCode} onChange={(event) => { setCountryCode(event.target.value); setCity(""); setPhoneNumber(""); }} aria-label="Phone country">{countries.map((item) => <option key={item.code} value={item.code} suppressHydrationWarning>{item.flag}  {item.name}</option>)}</select><ChevronDown size={15}/></div><div className="phone-number-input">{phoneDetails.callingCode && <span>{phoneDetails.callingCode}</span>}<input name="phoneNational" type="tel" inputMode={phoneDetails.callingCode ? "numeric" : "tel"} autoComplete="tel-national" value={phoneNumber} onChange={(event) => { const value = phoneDetails.callingCode ? event.target.value.replace(/\D/g, "").slice(0, maxPhoneDigits) : event.target.value.replace(/[^\d+]/g, "").slice(0, 16); setPhoneNumber(value); }} placeholder={phoneDetails.callingCode ? `${minPhoneDigits === maxPhoneDigits ? minPhoneDigits : `${minPhoneDigits}–${maxPhoneDigits}`} digits` : "+ country code and number"} minLength={phoneDetails.callingCode ? minPhoneDigits : undefined} maxLength={phoneDetails.callingCode ? maxPhoneDigits : 16} pattern={phoneLengthPattern} title={phoneDetails.callingCode ? `Enter ${phoneDetails.allowedLengths.join(" or ")} digits for ${phoneCountry.name}.` : "Include the full country calling code, such as +67212345678."} required /></div></div><small className="field-hint">{phoneDetails.callingCode ? `${phoneCountry.name} · enter ${phoneDetails.allowedLengths.join(" or ")} digits after ${phoneDetails.callingCode}.` : "This territory has no separate calling code. Enter a complete international number."}</small></label>
      {accountType === "business" && <>
        <label>Business name<input name="organizationName" autoComplete="organization" placeholder="e.g. Lahore Home Care" minLength={2} maxLength={180} required /></label>
        <div className="form-row signup-location">
          <label>Service type<div className="service-type-picker"><span className="service-type-icon"><ServiceIcon size={17}/></span><select name="businessType" value={businessType} onChange={(event) => setBusinessType(event.target.value as typeof businessType)} aria-label="Service type">{serviceTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14}/></div></label>
          <label className="city-field">City or town <CityAutocomplete value={city} onChange={setCity} cities={citySuggestions} loading={citiesLoading}/></label>
        </div>
      </>}
    </>}
    <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={320} required /></label>
    <label>Password<span className="password-wrap"><input name="password" type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} placeholder={isSignup ? "At least 12 characters" : "Enter your password"} minLength={isSignup ? 12 : 1} maxLength={128} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
    {!isSignup && <Link className="forgot-link" href="/forgot-password">Forgot password?</Link>}
    {isSignup && <label className="consent"><input type="checkbox" required /><span>I agree to the <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</span></label>}
    <button className="button button-dark auth-submit" type="submit" disabled={busy}>{busy ? <>Please wait <LoaderCircle size={16} className="spin" /></> : <>{isSignup ? "Create your account" : "Log in to GharSync"}<ArrowRight size={16}/></>}</button>
    {message && <p className="form-message" role="alert">{message}</p>}
    {isSignup && <p className="auth-form-footnote">Phone verification uses an SMS provider configured by your platform administrator.</p>}
  </form>;
}
