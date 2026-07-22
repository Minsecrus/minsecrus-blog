import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconFrame({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 10.8 12 4l8 6.8V20h-5v-5.5H9V20H4v-9.2Z" />
    </IconFrame>
  );
}

export function CurrentNodeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    </IconFrame>
  );
}

export function FitIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
      <circle cx="12" cy="12" r="2.5" />
    </IconFrame>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 12h14" />
    </IconFrame>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 12h14M12 5v14" />
    </IconFrame>
  );
}

export function DirectoryIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="6" cy="5" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="6" cy="19" r="1.5" />
      <path d="M7.5 5H11v14h-3.5M11 12h7M11 19h7" />
    </IconFrame>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 10.5V17M12 7.2h.01" />
    </IconFrame>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconFrame>
  );
}

export function GitHubIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3.2a8.8 8.8 0 0 0-2.78 17.15c.44.08.6-.19.6-.43v-1.7c-2.45.53-2.97-1.04-2.97-1.04-.4-1.02-.98-1.29-.98-1.29-.8-.55.06-.54.06-.54.89.06 1.35.91 1.35.91.79 1.35 2.07.96 2.58.73.08-.57.31-.96.56-1.18-1.95-.22-4.01-.98-4.01-4.35 0-.96.34-1.75.91-2.37-.09-.22-.4-1.12.09-2.33 0 0 .74-.24 2.42.9A8.4 8.4 0 0 1 12 7.37a8.4 8.4 0 0 1 2.2.3c1.68-1.14 2.42-.9 2.42-.9.49 1.21.18 2.11.09 2.33.57.62.91 1.41.91 2.37 0 3.38-2.06 4.12-4.02 4.34.32.27.6.81.6 1.64v2.47c0 .24.16.51.61.43A8.8 8.8 0 0 0 12 3.2Z" />
    </IconFrame>
  );
}
