import { describe, expect, it } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
  PageHeaderMetrics,
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

  it("renders page actions below the title content without decorative header statuses", () => {
    const markup = renderToStaticMarkup(createElement(PageHeader, {
      actions: createElement("button", { "data-slot": "action" }, "Crea"),
      status: createElement("span", { "data-slot": "status" }, "Attivo"),
      subtitle: "Descrizione",
      title: "Clienti",
    } as ComponentProps<typeof PageHeader>));

    expect(markup.indexOf("Descrizione")).toBeLessThan(markup.indexOf('data-slot="action"'));
    expect(markup).not.toContain('data-slot="status"');
  });

  it("does not render decorative statuses in metric page headers", () => {
    const markup = renderToStaticMarkup(createElement(PageHeaderMetrics, {
      metrics: [{ label: "Totale", value: 12 }],
      status: createElement("span", { "data-slot": "status" }, "12 attivi"),
      title: "Servizi",
    } as ComponentProps<typeof PageHeaderMetrics>));

    expect(markup).not.toContain('data-slot="status"');
  });
});
