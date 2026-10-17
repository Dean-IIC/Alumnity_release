"use client";

import { useEffect, useState } from "react";
import { chooseTheme, THEME_KEY, type ThemeChoice } from "../../lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; note: string }[] = [
  { value: "system", label: "Automatic", note: "Light or dark, as your phone or computer is set" },
  { value: "light", label: "Light", note: "Cream paper, dark ink" },
  { value: "dark", label: "Dark", note: "Dark paper, light ink: easier on the eyes at night" }
];

/** Light, dark, or as the device is set: kept on this device. */
export function ThemeChoicePicker() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") setChoice(saved);
    } catch {
      // No storage: stays on Automatic.
    }
  }, []);
  return (
    <fieldset className="theme-choice">
      <legend className="sr-only">How Alumnity looks</legend>
      {OPTIONS.map((o) => (
        <label key={o.value} className={`theme-choice__option theme-choice__option--${o.value}`}>
          <input
            type="radio"
            name="theme"
            value={o.value}
            checked={choice === o.value}
            onChange={() => {
              setChoice(o.value);
              chooseTheme(o.value);
            }}
          />
          <span className="theme-choice__swatch" aria-hidden="true" />
          <span>
            <strong>{o.label}</strong>
            <small>{o.note}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
