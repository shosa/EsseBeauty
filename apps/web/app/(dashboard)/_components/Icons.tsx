import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
      {...props}
    >
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.8,
};

export const DashboardIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M4 4h6v6H4zM14 4h6v10h-6zM4 14h6v6H4zM14 18h6v2h-6z" /></Icon>;
export const CalendarIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></Icon>;
export const ClientsIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m6.5-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-1a3 3 0 0 0 0-6m4.5 17v-2a4 4 0 0 0-3-3.87" /></Icon>;
export const ServicesIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" /></Icon>;
export const StaffIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm8 8a8 8 0 0 0-16 0" /></Icon>;
export const SettingsIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5 1.6-1.2-2-3.4-2 .8a7.8 7.8 0 0 0-2-1.2L14.7 5h-4l-.3 2a7.8 7.8 0 0 0-2 1.2l-2-.8-2 3.4L6 12a8 8 0 0 0 0 2l-1.6 1.2 2 3.4 2-.8a7.8 7.8 0 0 0 2 1.2l.3 2h4l.3-2a7.8 7.8 0 0 0 2-1.2l2 .8 2-3.4-1.6-1.2a8 8 0 0 0 0-2Z" /></Icon>;
export const MoreIcon = (props: IconProps) => <Icon {...props}><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></Icon>;
export const ModuleIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></Icon>;
export const LogoutIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M10 5H4v14h6m4-4 4-3-4-3m4 3H9" /></Icon>;
export const GripIcon = (props: IconProps) => <Icon {...props}><circle cx="8" cy="7" r="1" fill="currentColor" /><circle cx="16" cy="7" r="1" fill="currentColor" /><circle cx="8" cy="12" r="1" fill="currentColor" /><circle cx="16" cy="12" r="1" fill="currentColor" /><circle cx="8" cy="17" r="1" fill="currentColor" /><circle cx="16" cy="17" r="1" fill="currentColor" /></Icon>;
