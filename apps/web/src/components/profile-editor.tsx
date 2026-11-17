"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Eye, EyeOff, LoaderCircle, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { countries } from "@/lib/locations";
import { phoneCountryDetails } from "@/lib/phone-country";
import { CityAutocomplete } from "@/components/city-autocomplete";

const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
export function ProfileEditor({ initialName, email, phone, countryCode: initialCountry, city: initialCity, avatarUrl }: { initialName: string; email: string; phone: string | null; countryCode: string; city: string | null; avatarUrl: string | null }) {
  const [name, setName] = useState(initialName);
  const [countryCode, setCountryCode] = useState(initialCountry || "PK");
  const phoneDetails = useMemo(() => phoneCountryDetails(countryCode), [countryCode]);
  const minPhoneDigits = phoneDetails.allowedLengths.length ? Math.min(...phoneDetails.allowedLengths) : undefined;
  const maxPhoneDigits = phoneDetails.allowedLengths.length ? Math.max(...phoneDetails.allowedLengths) : 15;
  const phoneLengthPattern = phoneDetails.allowedLengths.length ? `(?:${phoneDetails.allowedLengths.map((length) => `\\d{${length}}`).join("|")})` : "\\+[1-9]\\d{7,14}";
  const initialCallingCode = phoneCountryDetails(initialCountry || "PK").callingCode;
  const [phoneNumber, setPhoneNumber] = useState(() => initialCallingCode && phone?.startsWith(initialCallingCode) ? phone.slice(initialCallingCode.length) : (phone ?? ""));
  const [city, setCity] = useState(initialCity ?? "");
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [avatar, setAvatar] = useState(avatarUrl);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const image = avatar ? `${api}${avatar}` : null;
  useEffect(() => {
    let active = true; setCitiesLoading(true);
    fetch(`/data/cities/${countryCode}.json`, { cache: "force-cache" }).then((response) => response.ok ? response.json() : []).then((items: unknown) => { if (active) setCities(Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : []); }).catch(() => { if (active) setCities([]); }).finally(() => { if (active) setCitiesLoading(false); });
    return () => { active = false; };
  }, [countryCode]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const callingCode = phoneDetails.callingCode;
      const fullPhone = callingCode ? `${callingCode}${phoneNumber.replace(/\D/g, "")}` : phoneNumber.replace(/\s/g, "");
      const response = await fetch(`${api}/auth/me/profile`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: name, countryCode, phone: fullPhone, city }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Profile save nahi ho saka.");
      setNotice("Profile updated successfully."); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }
  async function changePassword(event: React.FormEvent) {
    event.preventDefault(); setPasswordError(""); setPasswordNotice(""); setBusy(true);
    try { const response = await fetch(`${api}/auth/me/password`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Could not change password."); setCurrentPassword(""); setNewPassword(""); setPasswordNotice("Password changed. Other active sessions have been signed out."); }
    catch (e) { setPasswordError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!/image\/(jpeg|png|webp)/.test(file.type) || file.size > 10 * 1024 * 1024) { setError("Choose a JPEG, PNG or WebP image up to 10 MB."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch(`${api}/auth/me/avatar`, { method: "POST", credentials: "include", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Image upload nahi hui.");
      setAvatar(data.avatarUrl); setNotice("Profile photo updated successfully."); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function remove() {
    setBusy(true); setError(""); setNotice("");
    try { const response = await fetch(`${api}/auth/me/avatar`, { method: "DELETE", credentials: "include" }); if (!response.ok) throw new Error("Could not remove profile photo."); setAvatar(null); setNotice("Profile photo removed."); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }
  return <div className="profile-settings-grid"><section className="panel profile-photo-panel"><div className="profile-photo-large">{image ? <img src={image} alt="Profile photo"/> : <UserRound size={45}/>}</div><h2>Profile photo</h2><p>Choose a photo for your account.</p><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files?.[0])}/><button className="button button-primary" type="button" disabled={busy} onClick={() => input.current?.click()}><Camera size={15}/> Upload photo</button>{avatar && <button className="button button-secondary" type="button" disabled={busy} onClick={remove}><Trash2 size={14}/> Remove photo</button>}<small>JPEG, PNG or WebP · Up to 10 MB</small></section>
    <div className="profile-editor-column"><form className="panel profile-edit-panel" onSubmit={save}><span className="panel-kicker">ACCOUNT DETAILS</span><h2>Edit profile</h2><p className="panel-description">Update your name, country, phone number and city.</p><label>Full name<input required minLength={2} maxLength={160} value={name} onChange={(e) => setName(e.target.value)}/></label><label>Email address<input value={email} readOnly/><small>Email address changes are not available here.</small></label><label>Country<select value={countryCode} onChange={(event) => { setCountryCode(event.target.value); setPhoneNumber(""); setCity(""); }} aria-label="Select country">{countries.map((item) => { const callingCode = phoneCountryDetails(item.code).callingCode; return <option value={item.code} key={item.code} suppressHydrationWarning>{item.flag} {item.name}{callingCode ? ` (${callingCode})` : ""}</option>; })}</select></label><label>Phone number<div className="profile-phone-entry">{phoneDetails.callingCode ? <><span>{phoneDetails.callingCode}</span><input type="tel" inputMode="numeric" autoComplete="tel-national" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, maxPhoneDigits))} placeholder={`${minPhoneDigits ?? 8} digits`} minLength={minPhoneDigits} maxLength={maxPhoneDigits} pattern={phoneLengthPattern} title={phoneDetails.allowedLengths.length ? `Enter ${phoneDetails.allowedLengths.join(" or ")} digits for ${countries.find((item) => item.code === countryCode)?.name ?? "this country"}.` : "Enter a valid international phone number."} required/></> : <input type="tel" autoComplete="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/[^\d+]/g, ""))} placeholder="+ country code and number" pattern={phoneLengthPattern} required/>}</div><small>{phoneDetails.callingCode ? `${phoneDetails.callingCode} · Enter ${phoneDetails.allowedLengths.join(" or ")} digits.` : "Enter the full international number, including country code."}</small></label><label>City<CityAutocomplete value={city} onChange={setCity} cities={cities} loading={citiesLoading}/></label>{error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="profile-success"><Check size={14}/>{notice}</div>}<button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15}/> : <Check size={15}/>} Save changes</button></form>
    <form className="panel profile-edit-panel password-change-panel" onSubmit={changePassword}><span className="panel-kicker">ACCOUNT SECURITY</span><h2>Change password</h2><p className="panel-description">Use at least 12 characters for your new password.</p><label>Current password<div className="password-visibility-field"><input type={showCurrentPassword ? "text" : "password"} autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required/><button type="button" aria-label={showCurrentPassword ? "Hide password" : "Show password"} onClick={() => setShowCurrentPassword((value) => !value)}>{showCurrentPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label><label>New password<div className="password-visibility-field"><input type={showNewPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required/><button type="button" aria-label={showNewPassword ? "Hide password" : "Show password"} onClick={() => setShowNewPassword((value) => !value)}>{showNewPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>{passwordError && <div className="form-error" role="alert">{passwordError}</div>}{passwordNotice && <div className="profile-success"><Check size={14}/>{passwordNotice}</div>}<button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15}/> : <Check size={15}/>} Update password</button></form></div></div>;
}
