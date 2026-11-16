"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, MapPin } from "lucide-react";

export function CityAutocomplete({ value, onChange, cities, loading }: { value: string; onChange: (value: string) => void; cities: string[]; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => {
    const query = value.trim().toLocaleLowerCase();
    if (!query) return cities.slice(0, 8);
    return cities.filter((city) => city.toLocaleLowerCase().includes(query) && city !== value).slice(0, 8);
  }, [cities, value]);

  function choose(city: string) {
    onChange(city);
    setOpen(false);
  }

  return <div className="city-autocomplete">
    <div className="city-picker"><MapPin size={15}/><input name="city" value={value} onChange={(event) => { onChange(event.target.value); setActive(0); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={(event) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); setOpen(true); setActive((index) => Math.min(index + 1, matches.length - 1)); }
      if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
      if (event.key === "Enter" && open && matches[active]) { event.preventDefault(); choose(matches[active]!); }
    }} role="combobox" aria-autocomplete="list" aria-expanded={open && matches.length > 0} aria-controls="signup-city-options" aria-activedescendant={open && matches[active] ? `city-option-${active}` : undefined} placeholder="Search city" minLength={2} maxLength={100} autoComplete="address-level2" required /></div>
    {open && matches.length > 0 && <div id="signup-city-options" className="city-suggestion-list" role="listbox" aria-label="City suggestions">{matches.map((city, index) => <div id={`city-option-${index}`} key={city} className={index === active ? "active" : ""} role="option" aria-selected={index === active} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(city)}><MapPin size={12}/>{city}</div>)}</div>}
    <small className="field-hint">{loading ? <><LoaderCircle size={10} className="spin"/> Loading city choices…</> : cities.length ? `${cities.length.toLocaleString()} cities · type any city` : "Type any city or town"}</small>
  </div>;
}
