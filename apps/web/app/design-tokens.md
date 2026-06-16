# EsseBeauty Design Tokens

Source of truth for Phase 3 UI work. New dashboard/PWA UI should use these tokens through shared primitives from `@esse-beauty/ui` instead of raw magic values.

## Spacing

`0=0px`, `1=4px`, `2=8px`, `3=12px`, `4=16px`, `5=20px`, `6=24px`, `8=32px`, `10=40px`, `12=48px`, `16=64px`.

## Typography

- Page title: `32/40`, `700`, `-0.01em`
- Compact page title: `28/36`, `700`, `-0.01em`
- Section title: `20/28`, `700`
- Subsection title: `16/24`, `700`
- Table header: `12/16`, `700`, uppercase, `0.08em`
- Body: `14/22`, `400`
- Body strong: `14/22`, `600`
- Metadata/helper: `12/18`
- Badge: `11/16`, `700`, `0.04em`
- Error: `13/20`, `500`

## Radius

`none=0`, `sm=6px`, `md=10px`, `lg=12px`, `xl=16px`, `2xl=24px`, `full=9999px`.

## Shadows

- `none`: no shadow
- `sm`: subtle card
- `md`: floating card
- `lg`: dialog/drawer
- `focus`: accessible focus ring

## Colors

- Brand: `#2d1d27`, `#402334`, `#792f59`, `#8f3a68`, `#f3e2eb`, `#faf3f7`
- Page surfaces: `#f7f5f2`, `#f6f2f4`
- Card: `#ffffff`
- Text: primary `#1c1917`, secondary `#57534e`, muted `#78716c`
- Feedback: success `#ecfdf5/#047857`, warning `#fffbeb/#92400e`, danger `#fef2f2/#b91c1c`, info `#eff6ff/#1d4ed8`

## Motion

Use `motion` only.

- Instant: `80ms`
- Fast: `140ms`
- Normal: `220ms`
- Slow: `320ms`
- Standard easing: `[0.2, 0, 0, 1]`
- Exit easing: `[0.4, 0, 1, 1]`
- Emphasized easing: `[0.16, 1, 0.3, 1]`

## Primitives

Shared primitives must cover: `Button`, `Badge`, `Switch`, `Dialog`, `Drawer`, `ConfirmDialog`, `PageSkeleton`, `TableSkeleton`, `EmptyState`, `InlineError`, `SaveToast`, data table, schedule editor, breadcrumbs, command palette, and notification center.
