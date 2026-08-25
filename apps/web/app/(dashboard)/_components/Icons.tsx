import {
  Bell, BellRing, Blocks, Boxes, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined, ClipboardClock,
  DoorOpen, FileSignature, Gift, Grid2X2, HandCoins, HeartHandshake, History, Landmark,
  LayoutDashboard, LogOut, Megaphone, MessageCircleMore, MoreHorizontal, Package,
  PackageOpen, PanelLeft, Scissors, Settings, ShoppingBag, Star, Users, UserRound,
} from "lucide-react";
import type { ComponentProps } from "react";

type IconProps = ComponentProps<typeof LayoutDashboard>;

export const DashboardIcon = LayoutDashboard;
export const CalendarIcon = CalendarDays;
export const ClientsIcon = Users;
export const ServicesIcon = Scissors;
export const StaffIcon = UserRound;
export const SettingsIcon = Settings;
export const MoreIcon = MoreHorizontal;
export const ModuleIcon = Grid2X2;
export const RemindersIcon = BellRing;
export const ReviewsIcon = Star;
export const WaitlistIcon = ClipboardClock;
export const LoyaltyIcon = HeartHandshake;
export const VouchersIcon = Gift;
export const MarketingIcon = Megaphone;
export const InventoryIcon = Boxes;
export const ReportsIcon = ChartNoAxesCombined;
export const AccountingIcon = Landmark;
export const DocumentsIcon = FileSignature;
export const PackagesIcon = PackageOpen;
export const AuditIcon = History;
export const SalesIcon = HandCoins;
export const LogoutIcon = LogOut;
export const GripIcon = Blocks;
export const BellIcon = Bell;
export const SidebarToggleIcon = PanelLeft;
export const PackageIcon = Package;
export const ShoppingIcon = ShoppingBag;
export const DoorIcon = DoorOpen;
export const BriefcaseIcon = BriefcaseBusiness;
export const WhatsAppIcon = MessageCircleMore;
