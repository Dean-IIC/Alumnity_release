/** A connection as the pickers show it (Send a post, Tag people): shared by the server and the browser. */
export type PickPerson = { id: number; name: string; batch: string; photo: string | null };

/** Whether `p` matches what was typed in a picker's search box: every word starts a word of their name or batch. */
export function matchesSearch(p: PickPerson, typed: string): boolean {
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const own = `${p.name} ${p.batch}`.toLowerCase().split(/[\s,·()]+/);
  return words.every((w) => own.some((o) => o.startsWith(w)));
}
