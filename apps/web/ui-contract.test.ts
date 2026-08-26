import { describe, expect, it } from "vitest";

import {
  ActionBar,
  AppIconTile,
  AppLauncherPanel,
  ConfirmDialog,
  ContextTabs,
  Breadcrumbs,
  DataTable,
  EmptyState,
  ExpandableAction,
  FormField,
  InlineError,
  InboxItem,
  KpiStrip,
  PageSkeleton,
  AppPage,
  PageHeader,
  SaveToast,
  ScheduleEditor,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  TableSkeleton,
  WorkspaceToolbar,
  designTokens,
} from "@esse-beauty/ui";

describe("shared UI foundation contract", () => {
  it("exports design tokens and state primitives for dashboard remediation", () => {
    expect(designTokens.color.brand[900]).toBe("#402334");
    expect(designTokens.motion.duration.normal).toBe(0.22);
    expect(designTokens.layout.railWidth).toBe("76px");
    expect(designTokens.layout.tableRowHeight).toBe("46px");
    expect(ActionBar).toBeTypeOf("function");
    expect(AppPage).toBeTypeOf("function");
    expect(PageSkeleton).toBeTypeOf("function");
    expect(PageHeader).toBeTypeOf("function");
    expect(SectionCard).toBeTypeOf("function");
    expect(StatCard).toBeTypeOf("function");
    expect(StatGrid).toBeTypeOf("function");
    expect(StatusBadge).toBeTypeOf("function");
    expect(TableSkeleton).toBeTypeOf("function");
    expect(EmptyState).toBeTypeOf("function");
    expect(ExpandableAction).toBeTypeOf("function");
    expect(FormField).toBeTypeOf("function");
    expect(InlineError).toBeTypeOf("function");
    expect(SaveToast).toBeTypeOf("function");
    expect(ConfirmDialog).toBeTypeOf("function");
    expect(DataTable).toBeTypeOf("function");
    expect(ScheduleEditor).toBeTypeOf("function");
    expect(Breadcrumbs).toBeTypeOf("function");
    expect(AppIconTile).toBeTypeOf("function");
    expect(AppLauncherPanel).toBeTypeOf("function");
    expect(ContextTabs).toBeTypeOf("function");
    expect(WorkspaceToolbar).toBeTypeOf("function");
    expect(KpiStrip).toBeTypeOf("function");
    expect(InboxItem).toBeTypeOf("function");
  });
});
