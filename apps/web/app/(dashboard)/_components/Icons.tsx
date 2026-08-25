import {
  Bell, Blocks, Boxes, BriefcaseBusiness, CalendarDays, ChartNoAxesColumn,
  ClipboardList, DoorOpen, Grid2X2, Heart, LayoutDashboard, LogOut, Megaphone,
  MessageCircle, MessageSquare, MoreHorizontal, Package, PanelLeft, Settings, ShoppingBag,
  Sparkles, Users, UserRound, Volume2, WalletCards,
} from "lucide-react";
import type { ComponentProps } from "react";

type IconProps = ComponentProps<typeof LayoutDashboard>;

export const DashboardIcon = LayoutDashboard;
export const CalendarIcon = CalendarDays;
export const ClientsIcon = Users;
export const ServicesIcon = Sparkles;
export const StaffIcon = UserRound;
export const SettingsIcon = Settings;
export const MoreIcon = MoreHorizontal;
export const ModuleIcon = Grid2X2;
export const RemindersIcon = Volume2;
export const ReviewsIcon = MessageSquare;
export const WaitlistIcon = ClipboardList;
export const LoyaltyIcon = Heart;
export const MarketingIcon = Megaphone;
export const InventoryIcon = Boxes;
export const ReportsIcon = ChartNoAxesColumn;
export const SalesIcon = WalletCards;
export const LogoutIcon = LogOut;
export const GripIcon = Blocks;
export const BellIcon = Bell;
export const SidebarToggleIcon = PanelLeft;
export const PackageIcon = Package;
export const ShoppingIcon = ShoppingBag;
export const DoorIcon = DoorOpen;
export const BriefcaseIcon = BriefcaseBusiness;
export const WhatsAppIcon = MessageCircle;
