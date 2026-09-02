## Design Review Rules

When reviewing UI/UX designs, follow the design review process defined in:
- `.design-rules/SKILL.md` — Main review methodology
- `.design-rules/references/hig-lookup.md` — Topic-to-file mapping
- `.design-rules/references/hig/` — 53 design guideline documents

Always load the relevant guideline files before providing design feedback.

## EsseBeauty Web UI Conventions

Project-specific patterns that aren't in the generic HIG references above. Check the actual rendered page (or its CSS) before inventing a look-alike — don't guess from a screenshot or from memory of a similar page.

### Card hover/focus treatment: `.esse-panel`

The app-wide hover state for card-like panels (`SectionCard` in `packages/ui/index.tsx`, and any bespoke card markup) is **not** a Tailwind `hover:` utility combo and **not** a lift/translate. It's the global `.esse-panel` class defined in `apps/web/app/globals.css`:

```css
.esse-panel {
  isolation: isolate;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
@media (hover: hover) and (pointer: fine) {
  .esse-panel:hover {
    border-color: rgb(121 47 89 / 0.58);
    box-shadow:
      0 0 0 1px rgb(121 47 89 / 0.12),
      0 12px 32px rgb(121 47 89 / 0.2),
      0 4px 14px rgb(184 88 136 / 0.14);
  }
}
.esse-panel:focus-within {
  border-color: rgb(121 47 89 / 0.58);
  box-shadow: /* same as :hover */;
}
```

`SectionCard` applies this automatically. When building a custom card outside `SectionCard`, add `esse-panel` to its `className` — don't reimplement it with ad-hoc `hover:border-[...] hover:shadow-... hover:-translate-y-0.5` classes; that produces a visibly different (and inconsistent) effect. Other pages (e.g. `staff/page.tsx`, `marketing/page.tsx`) use their own bespoke hover treatments for *interactive selection cards* (buttons you click to select) — those are a deliberate different pattern from `.esse-panel` and shouldn't be confused with it. When in doubt about which one a page should use, check whether the target is a static info panel (→ `esse-panel`) or a clickable selectable card (→ check the specific page's existing button pattern).