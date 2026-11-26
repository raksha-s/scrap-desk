import type { ReactNode } from 'react';

const icon = (d: ReactNode) => <svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>;
export const Back = () => icon(<path d="M19 12H5M11.5 5.5 5 12l6.5 6.5" />);
export const Kebab = () => icon(<><circle cx="12" cy="5" r="2.1" /><circle cx="12" cy="12" r="2.1" /><circle cx="12" cy="19" r="2.1" /></>);
export const Pencil = () => icon(<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />);
export const Bin = () => icon(<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />);
export const Download = () => icon(<path d="M12 4v11M7 10.5 12 15.5l5-5M5 19h14" />);
export const Plus = () => icon(<path d="M5 12h14M12 5v14" />);
export const Minus = () => icon(<path d="M5 12h14" />);
export const RotateLeft = () => icon(<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5" />);
export const RotateRight = () => icon(<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" />);
export const ToFront = () => icon(<><rect x="8" y="8" width="11" height="11" rx="1.5" /><path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15" /></>);
