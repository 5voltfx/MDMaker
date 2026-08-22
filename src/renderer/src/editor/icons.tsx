import type { JSX } from 'react'

/** 24×24 stroke icons, drawn inline so the app stays self-contained. */
const paths: Record<string, JSX.Element> = {
  bold: (
    <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
  ),
  italic: (
    <>
      <path d="M19 4h-9M14 20H5M15 4L9 20" />
    </>
  ),
  strike: (
    <>
      <path d="M16 4H9a3 3 0 0 0-2.83 4" />
      <path d="M14 12a4 4 0 0 1 0 8H6" />
      <path d="M4 12h16" />
    </>
  ),
  code: (
    <>
      <path d="M15 6l6 6-6 6" />
      <path d="M9 18l-6-6 6-6" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  bulletList: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.3" />
      <circle cx="4.5" cy="12" r="1.3" />
      <circle cx="4.5" cy="18" r="1.3" />
    </>
  ),
  orderedList: (
    <>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M4 5.5h1V9M3.4 15.2c0-.7.6-1.2 1.3-1.2s1.3.5 1.3 1.1c0 1.1-2.6 1.6-2.6 3.4h2.7" />
    </>
  ),
  taskList: (
    <>
      <path d="M11 6h9M11 12h9M11 18h9" />
      <path d="M3 6.5l1.5 1.5L7.5 5" />
      <rect x="3" y="10.5" width="4.5" height="4.5" rx="1" />
      <rect x="3" y="16" width="4.5" height="4.5" rx="1" />
    </>
  ),
  quote: (
    <>
      <path d="M5 5h5v6a5 5 0 0 1-5 5" />
      <path d="M14 5h5v6a5 5 0 0 1-5 5" />
    </>
  ),
  codeBlock: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M14 9l2.5 3-2.5 3M10 15l-2.5-3L10 9" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9.5 10v10" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5-9 9" />
    </>
  ),
  rule: <path d="M4 12h16" />,
  source: (
    <>
      <path d="M14 4l-4 16" />
      <path d="M18 8l4 4-4 4M6 16l-4-4 4-4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  )
}

export type IconName = keyof typeof paths

export function Icon({ name }: { name: IconName }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
