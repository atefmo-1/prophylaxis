// One stroke weight, one grid (20px), drawn for this app.
const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconFirst = () => (
  <svg {...base}>
    <path d="M5 4v12M15 4l-6 6 6 6" />
  </svg>
);
export const IconPrev = () => (
  <svg {...base}>
    <path d="M12.5 4l-6 6 6 6" />
  </svg>
);
export const IconNext = () => (
  <svg {...base}>
    <path d="M7.5 4l6 6-6 6" />
  </svg>
);
export const IconLast = () => (
  <svg {...base}>
    <path d="M15 4v12M5 4l6 6-6 6" />
  </svg>
);
export const IconPause = () => (
  <svg {...base}>
    <path d="M7.5 5v10M12.5 5v10" />
  </svg>
);
export const IconPlay = () => (
  <svg {...base}>
    <path d="M7 4.5v11l8.5-5.5z" />
  </svg>
);
