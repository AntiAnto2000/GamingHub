import type { SVGProps } from "react";
type Props = SVGProps<SVGSVGElement>;
const Base = ({ children, ...props }: Props) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
export const PlayIcon = (props: Props) => <Base {...props}><path fill="currentColor" stroke="none" d="M8.25 5.7a1 1 0 0 1 1.52-.85l9.02 6.3a1.03 1.03 0 0 1 0 1.7l-9.02 6.3a1 1 0 0 1-1.52-.85V5.7Z"/></Base>;
export const PauseIcon = (props: Props) => <Base {...props}><path d="M9 6v12M15 6v12"/></Base>;
export const StopIcon = (props: Props) => <Base {...props}><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/></Base>;
export const PreviousIcon = (props: Props) => <Base {...props}><path d="M7 6v12M18 7.5 9.5 12l8.5 4.5v-9Z"/></Base>;
export const NextIcon = (props: Props) => <Base {...props}><path d="M17 6v12M6 7.5l8.5 4.5L6 16.5v-9Z"/></Base>;
export const LaunchIcon = (props: Props) => <Base {...props}><path d="M8 5h11v11M19 5 9 15"/><path d="M15 12v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h6"/></Base>;
