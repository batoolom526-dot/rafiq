import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
});

export const ISun = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const IList = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></svg>);
export const ITimer = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>);
export const IBook = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></svg>);
export const ISprout = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 21v-8" /><path d="M12 13c0-4 3-7 8-7 0 4-3 7-8 7z" /><path d="M12 15c0-3-2.5-5.5-7-5.5 0 3 2.5 5.5 7 5.5z" /></svg>);
export const IUser = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>);
export const IPlay = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></svg>);
export const IPause = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M8 5v14M16 5v14" /></svg>);
export const IPlus = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const ICheck = (p: SVGProps<SVGSVGElement>) => (<svg {...base({ strokeWidth: 3, ...p })}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const IX = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IMic = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>);
export const ISpeaker = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></svg>);
export const ISpark = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" fill="currentColor" stroke="none" /></svg>);
export const IWand = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 20L15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M9 4l.5 1.5M19 14l1.5.5" /></svg>);
export const ITrash = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>);
export const IEdit = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>);
export const IWave = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /></svg>);
export const ICal = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>);
export const IUpload = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>);
export const IChevron = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>);
