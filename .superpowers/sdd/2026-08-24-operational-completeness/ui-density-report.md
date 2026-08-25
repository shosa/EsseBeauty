# UI density pass

## Scope

Non-marketing dashboard list surfaces only. Marketing routes, API, schema and migrations were intentionally left untouched.

## Changes

- Inventory rows and headers use tighter vertical padding while preserving a stable minimum width and horizontal scrolling on narrow screens.
- Inventory now shows a concrete inline load-error state with an accessible alert and retry action.
- Service category cards and service result cards use compact spacing, smaller icon containers and clearer scan hierarchy.
- Service search and category controls remain keyboard-native buttons/inputs and retain visible labels.

## Verification

- `pnpm --filter @esse-beauty/web typecheck`
- `pnpm --filter @esse-beauty/web test -- --runInBand`
