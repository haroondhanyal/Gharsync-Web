"use client";

import { useEffect, useMemo, useState } from "react";
import { countries } from "@/lib/locations";
import { phoneCountryDetails } from "@/lib/phone-country";
import { CityAutocomplete } from "@/components/city-autocomplete";

export type LocationPhoneValue = { countryCode: string; city: string; phone: string };
export function CountryCityPhone({ value, onChange, phoneRequired = true }: { value: LocationPhoneValue; onChange: (value: LocationPhoneValue) => void; phoneRequired?: boolean }) {
  const phoneDetails = useMemo(() => phoneCountryDetails(value.countryCode), [value.countryCode]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const minLength = phoneDetails.allowedLengths.length ? Math.min(...phoneDetails.allowedLengths) : 8;
  const maxLength = phoneDetails.allowedLengths.length ? Math.max(...phoneDetails.allowedLengths) : 15;
  const pattern = phoneDetails.allowedLengths.length ? `(?:${phoneDetails.allowedLengths.map((length) => `\\d{${length}}`).join("|")})` : "\\+[1-9]\\d{7,14}";
  const normalizedPhone = phoneDetails.callingCode ? `${phoneDetails.callingCode}${value.phone.replace(/\D/g, "")}` : value.phone.replace(/\s/g, "");
  useEffect(() => {
    let active = true; setLoading(true);
    fetch(`/data/cities/${value.countryCode}.json`, { cache: "force-cache" }).then((response) => response.ok ? response.json() : []).then((data: unknown) => { if (active) setCities(Array.isArray(data) ? data.filter((city): city is string => typeof city === "string") : []); }).catch(() => { if (active) setCities([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [value.countryCode]);
  return <>
    <label>Country<select name="countryCode" value={value.countryCode} onChange={(event) => onChange({ countryCode: event.target.value, city: "", phone: "" })} required aria-label="Select country">{countries.map((country) => { const code = phoneCountryDetails(country.code).callingCode; return <option key={country.code} value={country.code} suppressHydrationWarning>{country.flag} {country.name}{code ? ` (${code})` : ""}</option>; })}</select></label>
    <label>Phone number<div className="profile-phone-entry">{phoneDetails.callingCode ? <><span>{phoneDetails.callingCode}</span><input type="tel" inputMode="numeric" autoComplete="tel-national" value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value.replace(/\D/g, "").slice(0, maxLength) })} minLength={minLength} maxLength={maxLength} pattern={pattern} placeholder={`${minLength} digits`} title={`Enter ${phoneDetails.allowedLengths.join(" or ")} digits for ${countries.find((country) => country.code === value.countryCode)?.name ?? "this country"}.`} required={phoneRequired}/></> : <input type="tel" autoComplete="tel" value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value.replace(/[^\d+]/g, "") })} placeholder="+ country code and number" pattern={pattern} required={phoneRequired}/>}</div><small>{phoneDetails.callingCode ? `Enter ${phoneDetails.allowedLengths.join(" or ")} digits for ${phoneDetails.callingCode}.` : "Enter the full international number with country code."}</small>{value.phone.trim() && <input type="hidden" name="phone" value={normalizedPhone}/>}</label>
    <label>City<CityAutocomplete value={value.city} onChange={(city) => onChange({ ...value, city })} cities={cities} loading={loading}/></label>
  </>;
}
