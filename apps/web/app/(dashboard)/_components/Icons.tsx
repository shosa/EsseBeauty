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
export const RemindersIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M7 4h10m-8 0v3a5 5 0 1 0 6 0V4M8 21h8M12 11v3l2 1" /></Icon>;
export const ReviewsIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M5 5h14v10H8l-3 3V5Zm4 4h6m-6 3h4" /><path {...stroke} d="m17.5 18.5.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" /></Icon>;
export const WaitlistIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M7 5h14M7 12h14M7 19h14M3.5 5h.01M3.5 12h.01M3.5 19h.01" /></Icon>;
export const LoyaltyIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z" /><path {...stroke} d="m12 11 1 2 2 .2-1.5 1.4.5 2-2-1.1-2 1.1.5-2L9 13.2l2-.2 1-2Z" /></Icon>;
export const MarketingIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M4 13h3l9 4V7L7 11H4v2Zm3 0v5h3l-2-5m8-3 4-2m-4 6 4 2" /></Icon>;
export const InventoryIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M4 8 12 4l8 4-8 4-8-4Zm0 0v8l8 4 8-4V8M12 12v8" /></Icon>;
export const ReportsIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M5 19V5m0 14h15M9 16v-5m4 5V8m4 8v-3" /></Icon>;
export const LogoutIcon = (props: IconProps) => <Icon {...props}><path {...stroke} d="M10 5H4v14h6m4-4 4-3-4-3m4 3H9" /></Icon>;
export const GripIcon = (props: IconProps) => <Icon {...props}><circle cx="8" cy="7" r="1" fill="currentColor" /><circle cx="16" cy="7" r="1" fill="currentColor" /><circle cx="8" cy="12" r="1" fill="currentColor" /><circle cx="16" cy="12" r="1" fill="currentColor" /><circle cx="8" cy="17" r="1" fill="currentColor" /><circle cx="16" cy="17" r="1" fill="currentColor" /></Icon>;
