import { db } from "./db";

/*
 * The site's switches. Super administrators change them in the college desk (every
 * change audited); the rules read them, so a switched-off feature is off on the server,
 * not just hidden.
 */

export type Settings = {
  /** New members may join. Off: the register still checks, but no new accounts. */
  joiningOpen: boolean;
  /** Each feature can be paused for everyone. What's already there stays readable. */
  features: { notes: boolean; asks: boolean; events: boolean; messages: boolean; openings: boolean };
  /** Connection requests one member may send in a day. */
  dailyRequests: number;
};

export const DEFAULT_SETTINGS: Settings = {
  joiningOpen: true,
  features: { notes: true, asks: true, events: true, messages: true, openings: true },
  dailyRequests: 25
};

export async function settings(): Promise<Settings> {
  const row = await db().one<{ value: string }>("select value from settings where key = 'site'");
  if (!row) return structuredClone(DEFAULT_SETTINGS);
  const saved = JSON.parse(row.value) as Partial<Settings>;
  return { ...DEFAULT_SETTINGS, ...saved, features: { ...DEFAULT_SETTINGS.features, ...saved.features } };
}

/** Only the desk calls this, after checking the super administrator; it audits too. */
export async function saveSettings(next: Settings, by: number) {
  await db().run(
    "insert into settings (key, value, updated_by, updated_at) values ('site', ?, ?, ?) on conflict(key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
    JSON.stringify(next),
    by,
    Date.now()
  );
}

export const FEATURE_LABEL: Record<keyof Settings["features"], string> = {
  notes: "Notes on Home (posting and comments)",
  asks: "Ask a senior (new questions)",
  events: "Events (putting up new ones)",
  messages: "Messages",
  openings: "Jobs & referrals (putting up new openings, asking for referrals)"
};

export const PAUSED = "The college has paused this for now. Everything already here stays as it is.";
