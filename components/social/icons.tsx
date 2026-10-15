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
  mention: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M15.5 12v1.3a2.2 2.2 0 0 0 4.4 0V12a8 8 0 1 0-3.2 6.4" />
    </>
  )
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}
