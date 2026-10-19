/* Small line icons, drawn with the same pen (2 px, round ends) and coloured by their text. */

const ICONS = {
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
  people: (
    <>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8M15.5 6.2a3 3 0 0 1 0 5.6M17 14.6c2 .5 3.2 2 3.6 4.4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  message: <path d="M4.5 6.5A1.5 1.5 0 0 1 6 5h12a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 18 16.5H10l-4.5 3.5v-3.5H6a1.5 1.5 0 0 1-1.5-1.5z" />,
  you: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" />
    </>
  ),
  bell: <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5zM10 20.5a2.2 2.2 0 0 0 4 0" />,
  photo: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <circle cx="9" cy="10.5" r="1.8" />
      <path d="m20.5 16-4.5-4.5-6.5 7" />
    </>
  ),
  story: (
    <>
      <circle cx="12" cy="12" r="8" strokeDasharray="3 2.4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  event: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  ask: (
    <>
      <path d="m3.5 11 17-6.5-6.5 17-2.5-7.5z" />
      <path d="m11.5 14 9-9.5" />
    </>
  ),
  comment: <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5V15a1.5 1.5 0 0 1-1.5 1.5H11L6.5 20v-3.5h0A1.5 1.5 0 0 1 5 15z" />,
  share: (
    <>
      <path d="M12 4v11M7.5 8.5 12 4l4.5 4.5" />
      <path d="M5.5 13v5a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-5" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18" cy="12" r="1.2" />
    </>
  ),
  everyone: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.2 2.3 2.2 13.7 0 16M12 4c-2.2 2.3-2.2 13.7 0 16" />
    </>
  ),
  batch: (
    <>
      <circle cx="8.5" cy="9" r="2.6" />
      <circle cx="15.5" cy="9" r="2.6" />
      <path d="M3.5 18c.5-2.5 2.5-4 5-4s4.5 1.5 5 4M10.5 18c.5-2.5 2.5-4 5-4s4.5 1.5 5 4" />
    </>
  ),
  connections: (
    <>
      <circle cx="7" cy="12" r="3" />
      <circle cx="17" cy="12" r="3" />
      <path d="M10 12h4" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4 4" />
    </>
  ),
  // People round a table: a group, not to be taken for People (two figures side by side).
  group: (
    <>
      <circle cx="12" cy="13.5" r="4.2" />
      <circle cx="12" cy="4.6" r="1.9" />
      <circle cx="4.4" cy="17.6" r="1.9" />
      <circle cx="19.6" cy="17.6" r="1.9" />
    </>
  ),
  heart: <path d="M12 19.5s-7-4.3-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.1c0 5.1-7 9.4-7 9.4z" />,
  briefcase: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17M11 12.5v1.5h2v-1.5" />
    </>
  ),
  grid: (
    <>
      <rect x="4.5" y="4.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="14" y="4.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="4.5" y="14" width="5.5" height="5.5" rx="1.2" />
      <rect x="14" y="14" width="5.5" height="5.5" rx="1.2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6" />
    </>
  ),
  shield: <path d="M12 3.8 5.5 6.3v5.3c0 4.1 2.8 7.2 6.5 8.6 3.7-1.4 6.5-4.5 6.5-8.6V6.3z" />,
  logout: <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10M14 8l4 4-4 4M18 12H9.5" />,
  mention: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M15.5 12v1.3a2.2 2.2 0 0 0 4.4 0V12a8 8 0 1 0-3.2 6.4" />
    </>
  ),
  // Two arrows chasing each other round: a repost.
  repost: <path d="M7 7.5h9.5a2 2 0 0 1 2 2V12M15.5 4.5l3 3-3 3M17 16.5H7.5a2 2 0 0 1-2-2V12M8.5 19.5l-3-3 3-3" />,
  // A paper plane, sent: passing a post on privately.
  send: <path d="M20 4 3.8 10.6l6.6 2.9 2.9 6.6zM20 4l-9.6 9.5" />,
  pen: <path d="M14.5 5.5l4 4L9 19H5v-4zM12.5 7.5l4 4" />,
  // A person with a small plus: tagging people in a post.
  "tag-people": (
    <>
      <circle cx="10" cy="8.5" r="3.3" />
      <path d="M3.8 19c.7-3.4 3.2-5.3 6.2-5.3 1.4 0 2.6.4 3.6 1.1M18 13.5v6M15 16.5h6" />
    </>
  )
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`icon icon--${name} ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}
