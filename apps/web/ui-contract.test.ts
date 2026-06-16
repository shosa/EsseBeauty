import { describe, expect, it } from "vitest";

import {
  ConfirmDialog,
  Breadcrumbs,
  DataTable,
  EmptyState,
  InlineError,
  PageSkeleton,
  SaveToast,
  ScheduleEditor,
  TableSkeleton,
  designTokens,
} from "@esse-beauty/ui";

describe("shared UI foundation contract", () => {
  it("exports design tokens and state primitives for dashboard remediation", () => {
    expect(designTokens.color.brand[900]).toBe("#402334");
    expect(designTokens.motion.duration.normal).toBe(0.22);
    expect(PageSkeleton).toBeTypeOf("function");
    expect(TableSkeleton).toBeTypeOf("function");
    expect(EmptyState).toBeTypeOf("function");
    expect(InlineError).toBeTypeOf("function");
    expect(SaveToast).toBeTypeOf("function");
    expect(ConfirmDialog).toBeTypeOf("function");
    expect(DataTable).toBeTypeOf("function");
    expect(ScheduleEditor).toBeTypeOf("function");
    expect(Breadcrumbs).toBeTypeOf("function");
  });
});
