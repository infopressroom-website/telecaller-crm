# Design system (Phase 02)

## Tokens (`tailwind.config.ts`)
| Token | Value | Use |
|---|---|---|
| `navy-900` / `navy-800` / `navy-300` | #0F1F3D / #1A2E55 / #C9D3E6 | Sidebar background / hover / text |
| `brand` (50, 100, 700) | #2557D6 | Primary actions, active nav, focus ring |
| `canvas` | #F4F6FA | Page background |
| `line` | #E3E7EF | Borders |
| `ink` / `ink-muted` | #14213D / #5B6577 | Text (muted passes AA on white) |
| `rounded-card` | 12px | Cards |

Font: Inter via `next/font`. Status colours live in `components/ui/badge.tsx` (`LEAD_STATUS_TONE`).

## Components
- Layout: `AppShell` (collapsible sidebar, mobile drawer, top bar, breadcrumbs). Variants `admin` and `telecaller`; menus in `config/navigation.ts`.
- UI: `Button`, `Badge`, `Card`/`StatCard`, `Skeleton`, `EmptyState`, `PageHeader`, `DataTable` + `Pagination`.
- Items whose page isn't built (`ready: false`) render disabled with a tooltip instead of linking to a 404. Flip `ready` when a phase ships the page.

## Rules
- Min touch target 44px; every icon-only control has an `aria-label`; colour never carries meaning alone.
- No decorative controls: search, notifications and profile menu are disabled placeholders until their phases.
- Dashboard values show "—" until Phase 04 computes them from the database.

## Not done yet in Phase 02
Form fields (React Hook Form), dialogs/confirmation prompts, filter bar, date-range control, toast/success feedback, notification centre, working global search. Add these before starting Phase 03.
