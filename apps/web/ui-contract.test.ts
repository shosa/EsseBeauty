import { describe, expect, it } from "vitest";

import {
  ActionBar,
  ConfirmDialog,
  Breadcrumbs,
  DataTable,
  EmptyState,
  FormField,
  InlineError,
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
  designTokens,
} from "@esse-beauty/ui";

describe("shared UI foundation contract", () => {
  it("exports design tokens and state primitives for dashboard remediation", () => {
    expect(designTokens.color.brand[900]).toBe("#402334");
    expect(designTokens.motion.duration.normal).toBe(0.22);
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
    expect(FormField).toBeTypeOf("function");
    expect(InlineError).toBeTypeOf("function");
    expect(SaveToast).toBeTypeOf("function");
    expect(ConfirmDialog).toBeTypeOf("function");
    expect(DataTable).toBeTypeOf("function");
    expect(ScheduleEditor).toBeTypeOf("function");
    expect(Breadcrumbs).toBeTypeOf("function");
  });
});
