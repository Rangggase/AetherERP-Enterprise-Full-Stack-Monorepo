# Design system

Scope: the visual layer of `frontend/` only. Behaviour, routes, API contracts, permissions and form validation do not change. The product is a data-dense ERP, so the rules favour legibility, ordered density and contrast over decoration.

## Principles

1. **Data first.** Tables, figures and forms are the interface. Chrome stays quiet.
2. **One surface, one level.** No card inside a card. Page background (`canvas`), then at most one raised `surface`. Sections inside a surface are separated by rules and spacing, not by more boxes.
3. **Colour carries meaning, never alone.** Status always pairs colour with an icon and a word.
4. **One system.** One font pair, one type scale, one radius pair, one button set, one focus ring. Anything outside the tokens below is a bug.
5. **Motion confirms an action.** No decorative animation.

## Tokens

Defined as CSS variables in `frontend/src/index.css` (RGB triplets so Tailwind can apply opacity). Primitive values are listed here; components use the semantic names only.

### Colour (semantic)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `canvas` | `#F0F2F5` | `#0B1019` | Page background |
| `surface` | `#FFFFFF` | `#131A26` | Tables, forms, panels |
| `sunken` | `#F6F8FA` | `#0F151F` | Table header, hover row, inputs' disabled ground |
| `line` | `#D0D7E0` | `#303C4F` | Decorative dividers and panel borders |
| `control-border` | `#7A8798` | `#647287` | Input, select and button outlines (3:1 non-text contrast) |
| `ink` | `#131C29` | `#E4E9F1` | Body text, headings |
| `muted` | `#4E5B6C` | `#96A3B5` | Secondary text, labels, captions |
| `brand` | `#0A6C6B` | `#38BDB4` | Primary action, links, active nav marker |
| `brand-hover` | `#085C5B` | `#56D0C6` | Primary hover |
| `on-brand` | `#FFFFFF` | `#061820` | Text on `brand` |
| `rail` | `#111B2E` | `#080C14` | Sidebar background |
| `rail-ink` | `#C8D2E1` | `#BEC8D7` | Sidebar link text |
| `rail-dim` | `#A8B4C6` | `#96A3B5` | Sidebar group labels |
| `brand-on-rail` | `#40C4BC` | `#38BDB4` | Logo mark on the sidebar |
| `disabled-bg` / `disabled-ink` | `#E2E7ED` / `#5C6878` | `#283242` / `#96A3B5` | Disabled controls (a distinct look, not reduced opacity) |

Status (each has `fg`, a 10–12% `bg` tint and a `border`):

| Status | Light fg | Dark fg | Icon | Used for |
| --- | --- | --- | --- | --- |
| `good` | `#0F7346` | `#4ACA8E` | check-circle | Paid, received, completed, posted, balanced |
| `warn` | `#965200` | `#E8AC46` | clock / alert-triangle | Needs approval, part-paid, low stock, overdue |
| `bad` | `#B02626` | `#F27878` | x-circle | Cancelled, reversed, error |
| `info` | `#1E5AAA` | `#82AAF0` | circle | Open, approved, confirmed, in transit |
| `idle` | `muted` | `muted` | circle | Draft, requested, closed |

Contrast, measured (WCAG AA needs 4.5:1 for text, 3:1 for control boundaries and icons):

| Pair | Light | Dark |
| --- | --- | --- |
| `ink` on `canvas` | 15.3 | 15.6 |
| `muted` on `canvas` / `surface` | 6.2 / 6.9 | 7.4 / 6.8 |
| `brand` on `surface` | 6.2 | 7.6 |
| `on-brand` on `brand` | 6.2 | 7.9 |
| `good` / `warn` / `bad` on `surface` | 5.9 / 6.0 / 6.7 | 8.4 / 8.7 / 6.4 |
| Status text on its own tint | 5.0–5.6 | 5.6–7.0 |
| `rail-ink` / `rail-dim` on `rail` | 11.3 / 8.2 | 11.6 / 7.6 |
| `disabled-ink` on `disabled-bg` | 4.6 | 5.1 |

### Typography

Two families, loaded from Google Fonts with `display=swap`:

- **Schibsted Grotesk** (400, 500, 600, 700): UI text, headings.
- **IBM Plex Sans** (400, 500, 600) with `tabular-nums`: money, quantities and any right-aligned numeric column. Its narrow commas avoid the wide "Rp 0 , 00" gaps the grotesk shows with tabular figures.

Root size is 16px. Scale (px / line-height):

| Role | Size | Weight | Where |
| --- | --- | --- | --- |
| `display` | 30 / 36 | 600 | Login headline only |
| `title` | 24 / 30 | 600 | Page title (`h1`) |
| `heading` | 18 / 26 | 600 | Section title (`h2`) |
| `subheading` | 15 / 22 | 600 | Panel and form group titles (`h3`) |
| `body` | 14 / 22 | 400 | Default text, form fields on desktop |
| `table` | 13 / 20 | 400 | Table cells and filters |
| `caption` | 12 / 16 | 400–500 | Hints, meta, pagination (never below 12) |
| `figure` | 26 / 30 | 600 | KPI values |

Rules: sentence case everywhere; no all-caps labels; headings use `text-wrap: balance`; line length at most 75 characters for prose; one `h1` per page and no skipped levels. Inputs are 16px below 640px so mobile browsers do not zoom.

### Spacing

4px base: `4, 8, 12, 16, 24, 32, 48`. Page gutter 16px (mobile) / 24px (desktop). Gap between page sections 24px, inside a surface 16px. Table cell padding 8px × 12px (compact), 12px × 12px on touch widths.

### Radius and elevation

- Radius: **4px** for controls, badges and table cells; **8px** for surfaces, menus and the toast. Nothing else.
- Elevation: level 0 is a 1px `line` border (default for surfaces); level 1 is a popover shadow (`0 4px 14px rgb(ink / 12%)`) for menus; level 2 (`0 10px 28px rgb(ink / 18%)`) for the mobile drawer and toasts. No shadow on tables, panels or buttons.

### Focus

One ring everywhere: 2px `brand` outline with 2px offset, on `:focus-visible` only. Sticky header and sidebar use `scroll-margin` so a focused control is never covered.

## Components

| Component | Rules |
| --- | --- |
| Button | Height 36px desktop, 44px on touch widths for primary actions in forms and toolbars. Primary = `brand` fill; secondary = surface fill with `control-border`; quiet = text only for row actions. Hover steps the fill, press moves 1px down, disabled uses `disabled-bg`/`disabled-ink`. Labels are a verb plus object ("Simpan faktur"). |
| Row action | 32px minimum height and 32px minimum width; at most two per row; a third goes in the same row's secondary position, not a menu. |
| Input, select | 36px (40px touch), `control-border`, 4px radius, label always visible above, hint under, error under in `bad` with an icon and `aria-describedby`. Explicit `name` on every control. `color-scheme` set so native pickers follow the theme. |
| Table | Header `sunken`, 13px text, numeric columns right-aligned in the numeric face, sticky first column and horizontal scroll on narrow screens (see below). Filter row collapses behind a "Filter" toggle per table; the filter inputs and behaviour are unchanged. |
| Badge (status) | Icon + word, status `fg` on status `bg`, 4px radius, 12px text, one word where possible. |
| Panel | `surface` with a 1px `line` border and 8px radius; no nested panels; header row = `subheading` plus optional action. |
| KPI strip | One continuous ruled band (not separate cards): label (caption), figure, one line of context. Value never truncated; on mobile it wraps to two columns. |
| Toast | Bottom right (bottom, full width on mobile), level 2, `aria-live="polite"`, error variant keeps the "Gagal." prefix and stays 6 s. |
| Inline confirm | Used for destructive steps instead of a modal; keeps focus and shows both outcomes. |

### Tables on narrow screens

Decision: **scrollable with visible cues**, not a card view. A card view would restructure every table's DOM and risk behavioural differences in sorting, filtering and row actions, which this task must not change.

- The table sits in a scroll container with CSS scroll shadows on the left and right edges, shown only while more content lies in that direction.
- The first column stays sticky so rows remain identifiable.
- A one-line hint, "Geser ke samping untuk kolom lain", appears above tables that overflow, below 768px only.
- Money keeps its digits; the column width is not reduced, the user scrolls.

## Motion

Feedback only. Tokens: `fast` 100ms (press), `base` 150ms (hover, focus, status change), `slow` 200ms (panel open, drawer). Easing `cubic-bezier(0.2, 0, 0, 1)`. Animate `opacity`, `transform`, `background-color`, `color` and `border-color` only; never `width`, `height` or `transition: all`. The sidebar collapse becomes instant because its width cannot be animated cheaply. A newly saved row or status change flashes its status badge background once (150ms). Everything respects `prefers-reduced-motion` by dropping to 0.01ms. Skeleton loading pulses stay (a loading indicator, not decoration) and stop under reduced motion.

## Copy and language

The interface is in Indonesian (`<html lang="id">`). Messages that come from the server stay in English and are shown as received.

- Sentence case. Active voice. No "Silakan" or filler.
- Buttons: verb plus object ("Simpan pelanggan", "Catat retur"). Same action, same word on the button, toast and heading.
- Errors say what happened and what to do next. Empty states give the next action.
- Numbers and dates use `id-ID` formatting. SKUs, document numbers, account codes and permission codes are never translated.
- Glossary: Dashboard = Dasbor, Purchase order = Pesanan pembelian, Goods receipt = Penerimaan barang, Supplier = Pemasok, Product = Produk, Stock level = Level stok, Stock card = Kartu stok, Transfer = Transfer antar gudang, Assembly = Perakitan, Reorder advice = Saran pesan ulang, Sales order = Pesanan penjualan, Return = Retur, Customer = Pelanggan, Journal entry = Jurnal umum, Invoice = Faktur, Bill = Tagihan, Financial report = Laporan keuangan, Fiscal period = Periode fiskal, Audit log = Log audit, User = Pengguna, Role = Peran, Sign in = Masuk, Sign out = Keluar.
- The activity feed maps each `action` and `entity_type` to a short Indonesian phrase ("Retur penjualan dicatat"); unknown values fall back to the raw text, and consecutive identical events are not collapsed because that would change the data shown.

## Accessibility checklist

Contrast per the table above; visible focus ring; every control named (visible label or `aria-label`); every input has `name`, `autocomplete` where applicable and a type; headings in order; targets at least 32px (44px for primary touch actions); no layout-affecting animation; `color-scheme`, `theme-color` and favicon set; light and dark both verified.
