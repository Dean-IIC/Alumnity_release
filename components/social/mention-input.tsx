"use client";

import { useEffect, useRef, useState } from "react";

type Person = { id: number; name: string; batch: string };

type Props = {
  /** The hidden field the text is sent in (mentions written as `@[Name](id)`). */
  name: string;
  placeholder?: string;
  rows?: number;
  maxLength: number;
  required?: boolean;
  className?: string;
  /** Changes when the form has been sent, to clear the box. */
  resetKey?: unknown;
  onTextChange?: (text: string) => void;
  autoFocus?: boolean;
  id?: string;
  label: string;
};

/**
 * A text box that suggests people as you type @ and a name. The box shows "@Asha Rao";
 * what's sent says which Asha it is, so the server can check and link it.
 */
export function MentionInput({ name, placeholder, rows = 3, maxLength, required, className = "", resetKey, onTextChange, autoFocus, id, label }: Props) {
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<Person[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText("");
    setChosen([]);
    setQuery(null);
  }, [resetKey]);

  // Ask for names a moment after typing stops.
  useEffect(() => {
    if (query === null || query.length < 1) {
      setPeople([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/people/suggest?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d) => {
          setPeople(d.people ?? []);
          setActive(0);
        })
        .catch(() => undefined);
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  /** The text as sent: each chosen "@Name" becomes "@[Name](id)". */
  const sent = chosen.reduce((t, p) => t.split(`@${p.name}`).join(`@[${p.name}](${p.id})`), text);

  const update = (value: string, caret: number) => {
    setText(value);
    onTextChange?.(value);
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|\s)@([\p{L}.]{0,30}(?: [\p{L}.]{0,30})?)$/u);
    setQuery(m ? m[1] : null);
  };

  const pick = (p: Person) => {
    const el = box.current;
    if (!el) return;
    const caret = el.selectionStart ?? text.length;
    const start = text.slice(0, caret).lastIndexOf("@");
    const next = `${text.slice(0, start)}@${p.name} ${text.slice(caret)}`;
    setText(next);
    onTextChange?.(next);
    setChosen((c) => (c.some((x) => x.id === p.id) ? c : [...c, p]));
    setQuery(null);
    requestAnimationFrame(() => {
      const at = start + p.name.length + 2;
      el.focus();
      el.setSelectionRange(at, at);
    });
  };

  const open = query !== null && people.length > 0;

  return (
    <div className={`mention-input ${className}`}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <textarea
        ref={box}
        id={id}
        value={text}
        rows={rows}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={id ? `${id}-people` : undefined}
        onChange={(e) => update(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % people.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + people.length) % people.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(people[active]);
          } else if (e.key === "Escape") {
            setQuery(null);
          }
        }}
      />
      <input type="hidden" name={name} value={sent} />
      {open && (
        <ul className="mention-input__people" role="listbox" id={id ? `${id}-people` : undefined}>
          {people.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
                <strong>{p.name}</strong>
                <span>{p.batch}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
