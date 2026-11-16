const P = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

export const TodayIcon = () => (
  <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.4 4.6-5" /></svg>
);
export const WeekIcon = () => (
  <svg viewBox="0 0 24 24" {...P}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
);
export const InsightsIcon = () => (
  <svg viewBox="0 0 24 24" {...P}><path d="M5 19V13M10 19V9M15 19v-4M20 19V5" /></svg>
);
export const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" {...P}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
);
