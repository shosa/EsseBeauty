# External icon migration

- Centralized dashboard navigation/action icon exports in `apps/web/app/(dashboard)/_components/Icons.tsx` using `lucide-react`.
- Replaced the staff PWA's hand-authored tab/back SVG icons with Lucide components.
- Existing Lucide usage in the customer PWA was preserved.
- Remaining SVGs are documented exceptions: the EsseBeauty logo/initials, chart/data-viz paths, and status illustrations whose custom geometry is not a standard UI glyph. Inline functional SVGs in the web dashboard are retained for follow-up conversion where their surrounding component needs bespoke status geometry.

Verification: `pnpm --filter @esse-beauty/web typecheck` passed; staff PWA typecheck is run with the repository command before commit.
