type IconProps = { size?: number; className?: string };

const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const KanbanIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M8 7v10" />
    <path d="M14 7v6" />
  </svg>
);

export const KeyIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.85 12.15 7.4-7.4" />
    <path d="m18 5 2 2" />
    <path d="m15 8 2 2" />
  </svg>
);

export const NoteIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h5" />
  </svg>
);

export const PenIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

export const LogoutIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

// Drawing toolbar icons (standardized stroke)
export const SelectIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m4 4 6 16 2-6 6-2z" />
  </svg>
);

export const PencilIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
    <path d="m15 5 4 4" />
  </svg>
);

export const RectIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="5" width="18" height="14" rx="1" />
  </svg>
);

export const CircleIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
  </svg>
);

export const ArrowIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="13 6 19 12 13 18" />
  </svg>
);

export const TextIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);

export const EraserIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4L13 5l6 6-9.3 9.3a1 1 0 0 1-1.4 0L7 21" />
    <path d="M22 21H8" />
    <path d="m5 11 9 9" />
  </svg>
);

export const TrashIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const PlusIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const MinusIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const SunIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

export const MoonIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

/** Sliders — “style” panel for stroke & color */
export const SlidersIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);
