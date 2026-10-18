import type { ReactNode } from 'react'

const paths: Record<string, ReactNode> = {
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  download: <path d="M12 4v12m0 0-5-5m5 5 5-5M5 20h14" />,
  upload: <path d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  thread: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="17" r="2.5" />
      <path d="M8 7.5c4 1 3 6 8 8" />
    </>
  ),
  front: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="1.5" />
      <path d="M5 15V6a1 1 0 0 1 1-1h9" />
    </>
  ),
  back: (
    <>
      <rect x="5" y="5" width="11" height="11" rx="1.5" />
      <path d="M19 9v9a1 1 0 0 1-1 1H9" />
    </>
  ),
  duplicate: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2" />
    </>
  ),
  trash: <path d="M5 7h14M10 7V5h4v2m-7 0 1 12h8l1-12" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  open: <path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="19" cy="12" r="1.3" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="6" cy="17" r="2.5" />
      <path d="M8 8.5 20 17M8 15.5 20 7" />
    </>
  ),
  unlink: <path d="M9 15l-1.5 1.5a3.5 3.5 0 0 1-5-5L4 10m11-1 1.5-1.5a3.5 3.5 0 0 1 5 5L20 14M8 4v2M4 8h2M16 20v-2M20 16h-2" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  back_arrow: <path d="M15 5l-7 7 7 7" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  redo: <path d="m15 14 5-5-5-5m5 5H10a6 6 0 0 0 0 12h3" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  rename: <path d="M4 20h16M6 16l9.5-9.5 3 3L9 19H6z" />,
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 18 5-5 3 3 2-2 4 4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  check: <path d="m5 12 5 5 9-10" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
}

export type IconName = keyof typeof paths

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  )
}
