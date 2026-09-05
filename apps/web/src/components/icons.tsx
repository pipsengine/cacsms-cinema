import type { ReactNode } from 'react';
export function Icon({children}:{children:ReactNode}) { return <span className="icon" aria-hidden>{children}</span>; }