# Design system v2: "kertas dan tinta"

Scope: the visual and interaction layer of `frontend/` only. Backend, API contracts, business logic (returns, FIFO, journals, account classification), the 16 permissions, validation rules and displayed data do not change. Every action available today stays available, sometimes by a better route. The earlier system is kept as `design-system-v1.md` for reference.

The concept screens are in `docs/prototypes/v2/` with screenshots `docs/screenshots/v2-concept-*.png`.

## Direction

Calm, editorial and exact, like a well-set ledger. Hierarchy comes from type and thin rules, not boxes. Light theme only.

1. **Type and rules carry structure.** A page is a column of ruled sections. No row of equal cards, no shadows, no gradients, no glow.
2. **One accent.** Oxblood `#7A2E2A` marks the primary action, the active item and the main data series. Nothing else is decorative.
3. **Specific words.** Microcopy names the thing and the amount ("4 faktur piutang lewat jatuh tempo, Rp34,5 jt"), never a generic heading like "Ringkasan".
4. **Asymmetry with a reason.** A wide main column holds what needs action; a narrow column holds reference figures.
5. **Icons only where words fail:** close, sort, warning. No icons in buttons, menus or headings.
6. **Motion confirms an action** and never decorates.

## Tokens

Defined as CSS variables in `frontend/src/index.css`; Tailwind maps to them. Components use semantic names only.

### Colour

| Token | Value | Use |
| --- | --- | --- |
| `bg` | `#F4F1EA` | Page |
| `surface` | `#FBFAF6` | Inputs, drawer, dialog, sticky bars |
| `ink` | `#1E1B18` | Text, strongest rule |
| `muted` | `#6B645A` | Secondary text, labels |
| `line` | `#DCD6CA` | Decorative dividers only |
| `control` | `#8C8478` | Borders of inputs, selects, secondary buttons (non-text contrast) |
| `accent` | `#7A2E2A` | Primary button, active nav rule, main chart series, links |
| `accent-hover` | `#692622` | Primary button hover |
| `good` | `#3F6B4E` | Success, balanced, paid |
| `warn` | `#B07A1E` | Chart marks and rules only, never text |
| `warn-ink` | `#8A5F12` | Warning text |
| `bad` | `#9E3B32` | Error, reversed, cancelled |
| `info` | `#3D5A73` | Open, approved, in transit |

Two values differ from the brief, because the briefed ones fail WCAG AA as measured: `warn` as text is 3.3 to 3.6:1, so text uses `warn-ink`; and `line` is 1.3:1, so control borders use `control`.

Measured contrast (WCAG ratio; text needs 4.5, control borders 3):

| Pair | on `bg` | on `surface` |
| --- | --- | --- |
| `ink` | 15.2 | 16.4 |
| `muted` | 5.2 | 5.6 |
| `accent` text | 8.3 | 8.9 |
| white on `accent` (primary button) | 9.3 | |
| `good` | 5.4 | 5.9 |
| `warn-ink` | 5.0 | 5.4 |
| `bad` | 6.0 | 6.4 |
| `info` | 6.4 | 6.9 |
| `control` (non-text) | 3.3 | 3.5 |

`accent-hover`, disabled and focus pairs are measured at the end of implementation and reported in the final table.

### Status

A status is a 7px square mark plus a word in the status colour. Never a pill, never colour alone. Only existing statuses are used.

| Colour | Statuses |
| --- | --- |
| `good` | Lunas, Diterima, Selesai, Terposting |
| `warn-ink` | Perlu persetujuan, Diterima sebagian, Dibayar sebagian |
| `info` | Disetujui, Terkonfirmasi, Terkirim, Ditagih, Terfaktur, Terbuka, Dalam perjalanan |
| `bad` | Dibalik, Dibatalkan |
| `muted` | Draf, Penawaran, Diminta, Ditutup |

### Typography

Fonts (Google Fonts, `display=swap`, verified loaded with `document.fonts.check`):

- **Source Serif 4** (500, 600): page titles, document numbers, the single headline figure, action counts.
- **IBM Plex Sans** (400, 500, 600): everything else. Tables and money use `tabular-nums lining-nums`.

| Role | Font | Size / line | Weight |
| --- | --- | --- | --- |
| Figure | Serif | 56 / 60 (44 / 48 mobile) | 500 |
| Title | Serif | 30 / 36 (26 / 32 mobile) | 500 |
| Document number, drawer title | Serif | 22 / 28 | 500 |
| Action count | Serif | 28 / 32 | 500 |
| Section label | Sans | 13 / 20 | 600 |
| Body | Sans | 14 / 22 | 400 |
| Table, microcopy | Sans | 13 / 20 | 400–500 |
| Caption | Sans | 12 / 16 | 400 |

Sentence case. No all-caps. Lines at most 75 characters. Inputs are 16px below 800px.

### Space, radius, elevation

- **Grid 8px.** Steps 4, 8, 16, 24, 32, 40, 48. Page gutters 40px (16px mobile). Main column maximum 1180px.
- **Radius 4px** for buttons, inputs, chips and the dialog. Nothing larger.
- **Elevation: none.** Layers are separated by a 1px `ink` rule or border (drawer, dialog, sticky action bar). The dialog backdrop is `ink` at 38% opacity.

### Focus and hover

One focus ring: 2px `accent`, 2px offset, on `:focus-visible`. Hover on rows is `ink` at 3.5%, selected rows are `accent` at 6% with a 2px `accent` left rule.

## Application frame

- **Sidebar** 192px, text only, grouped (Dasbor, Pengadaan, Gudang, Penjualan, Akuntansi, Sistem). Active item has a 2px left rule in `accent` and weight 600. Items are shown by permission as today.
- **Top bar** 44px: breadcrumb (current page in `ink`, ancestors in `muted`, each ancestor a link), branch selector, period indicator, global search, user menu. The period indicator stays an indicator.
- **Global search** (`/` focuses it): filters the lists the app has already loaded (sales and purchase orders, invoices, products, customers, suppliers; up to 200 rows each). There is no server-side search.
- **Command palette** (Ctrl+K): a native `<dialog>` with a listbox; navigates to pages the user may see and searches the same loaded lists. Arrow keys move, Enter opens, Escape closes. No new dependency.
- **Mobile (below 800px):** sidebar becomes a full-height drawer from the left opened by a "Menu" text button; the search collapses to a button.

## Page patterns

### Dashboard by role

Order on every dashboard: **Perlu tindakan**, then one headline figure with small facts beside it, then a chart or table. Widgets are chosen by the user's permissions; the backend remains the real access guard (the overview endpoint still returns what it returns, the frontend only chooses what to show).

| Role (from seed) | Perlu tindakan | Headline figure | Chart or table |
| --- | --- | --- | --- |
| Admin | all items below | Pendapatan bersih bulan ini | Pendapatan vs HPP |
| Finance Manager (`payments.write`, `accounting.close`) | faktur lewat jatuh tempo, terkirim belum difaktur, diterima belum ditagih, tagihan pemasok jatuh tempo | Pendapatan bersih bulan ini | Pendapatan vs HPP |
| Procurement Manager (`procurement.approve`) | pesanan pembelian menunggu persetujuan, disetujui menunggu barang, stok di bawah titik pesan ulang | Nilai pesanan pembelian terbuka | Tabel stok di bawah titik pesan ulang |
| Procurement Staff (`procurement.write`) | draf belum diajukan, disetujui menunggu barang, diterima belum ditagih | Nilai pesanan pembelian terbuka | Tabel stok di bawah titik pesan ulang |
| Warehouse Staff (`inventory.write`) | pesanan terkonfirmasi menunggu pengiriman, disetujui menunggu barang, transfer diminta atau dalam perjalanan, stok kritis | Nilai persediaan FIFO | Tabel stok di bawah titik pesan ulang |
| Sales Staff (`sales.write`) | penawaran menunggu konfirmasi, terkonfirmasi menunggu pengiriman, terkirim belum difaktur | Penjualan bulan ini | Penjualan 6 bulan |
| Auditor (`audit.read`) | none (read only) | Jumlah kejadian audit 7 hari terakhir | Daftar kejadian terbaru |

Counts come from the existing list endpoints with status filters (up to 200 rows). "Retur menunggu" is not shown because returns have no status. An empty "Perlu tindakan" reads "Tidak ada yang perlu ditindaklanjuti sekarang." and the next section moves up.

### List pages (one pattern)

- Title (serif) with a second line stating the count and one fact ("6 dari 26 pesanan · total Rp75,8 jt"), one primary action at the right.
- Toolbar: search, removable filter chips, "Tambah filter" text button, density toggle (Nyaman 44px rows, Rapat 32px rows; remembered per user in `localStorage`).
- Table: header sticky under the top bar, ruled with `ink`; numbers right-aligned in tabular figures; status as mark plus word; the row opens a **preview drawer** from the right (420px, Escape closes, focus moves into it and returns on close) with the key facts, the first items and two actions: "Buka dokumen" and the main secondary action.
- Footer: compact pager ("Menampilkan 1–6 dari 6", "Halaman 1 dari 1"). CSV export stays, as a text button in the toolbar.
- Mobile: rows stack (number and total; customer and date; status). The table keeps `role="table"` semantics.

### Document detail

Header: document type (caption), number (serif), one line of facts, then actions by status and permission (one primary, one secondary, text actions). Under it a **stage line** built from the existing statuses (for a sales order: Penawaran, Terkonfirmasi, Terkirim, Terfaktur, Dibayar sebagian / Lunas) with completed stages ruled in `ink` and the current one in `accent`. Then a definition list of key facts, then tabs **Item**, **Jurnal**, **Riwayat**. Actions that are unavailable in the current status are not shown. Jurnal lists the journals posted from the document; Riwayat lists audit entries for it.

### Forms

Groups with a small title and a one-line hint at the left (200px) and fields at the right; one column on mobile. Validation appears under the field in `bad` with the fix. A **sticky action bar** at the bottom carries the computed impact and the actions. For a return: Kredit ke pelanggan and Sisa tagihan setelah retur, computed from data already loaded; Biaya stok kembali shows "dihitung saat dicatat" because the API does not expose the cost before posting, and the exact figure is shown on the confirmation after it is recorded.

### States

- **Empty:** one sentence and one action ("Belum ada retur. Catat retur dari pesanan yang sudah difaktur.").
- **Loading:** skeletons that copy the layout (rule lines and grey bars), not spinners.
- **Error:** what happened, what the user can do, a "Coba lagi" text button. Server messages stay in English as received.
- **Chart without data:** no axes; one sentence in its place.
- **Risky actions** (batalkan, catat retur, tutup tahun) open a confirmation dialog that lists the consequences in the user's terms and offers "Kembali" and a specific confirm label.

## Components

| Component | Rules |
| --- | --- |
| Button | 32px high (44px below 800px), 4px radius, 14px label, no icons. Primary: `accent` fill, white text. Secondary: 1px `control` border. Text: no border, underline on hover. Danger: 1px `bad` border and text. Disabled: `muted` text on transparent with a dashed `line` border. Press moves 1px down. |
| Input, select | 32px (44px mobile), `surface` fill, 1px `control` border, 4px radius, visible label above, hint or error below, explicit `name`. |
| Chip | 26px, 1px `control` border, label plus a "×" button named "Hapus filter …". |
| Status | Mark plus word, see above. |
| Tabs | Text with a 2px `accent` underline on the current tab. |
| Dialog and drawer | Native `<dialog>`; 1px `ink` border; focus trapped; Escape closes; focus returns to the trigger. |
| Toast | Bottom right, `surface`, 1px `ink` border, `aria-live="polite"`; errors start with "Gagal." |

## Charts

Recharts stays (already installed), with rules from the dataviz method: one main series in `accent`, one comparison in `muted`, 2px lines, a 4px end marker, direct labels at the end of each line instead of a legend, three light gridlines at most, no gradients or glow. A "Lihat sebagai tabel" disclosure gives the same data as a table. Chart text is `muted`, labels in `ink`. The series colour never changes with filters.

## Motion

Frequency first: lists, tables and typing are never animated. Allowed: button press (100ms), hover and focus colour (120ms), drawer in from the right (200ms, transform), dialog and menu fade (150ms, opacity), toast fade (150ms). Easing `cubic-bezier(0.2, 0, 0, 1)`. Only `opacity`, `transform` and colour are animated. `prefers-reduced-motion` removes all of it. There are no count-up numbers, bounces or scale effects.

## Language

The UI is Indonesian (`<html lang="id">`); server messages stay as received. Sentence case, active voice, labels name the object ("Catat retur", "Buat faktur"). Numbers use `id-ID` formatting; compact money is "Rp41,4 jt". Codes (SKU, document numbers, account codes, permissions) are never translated.

## Accessibility

Contrast per the table; one focus ring on every control; visible labels; headings in order, one `h1`; targets at least 32px (44px for primary mobile actions); keyboard: Tab order follows reading order, Escape closes layers, Ctrl+K opens the palette, `/` focuses search (ignored while typing in a field); skip link retained; dialogs and drawers are modal with focus return.

## Changes that approach behaviour (to approve)

1. Row preview drawer on list pages.
2. Global search and command palette (Ctrl+K, `/`), working on loaded lists.
3. Removable filter chips replacing the per-column filter inputs; the same filtering, a different control.
4. Row density choice, stored in `localStorage`.
5. Confirmation dialogs for batalkan, retur and tutup tahun (the retur form already had no confirmation; this adds one).
6. Actions hidden when unavailable for a status, instead of disabled.
7. Dark theme and its toggle removed (light only).
8. Mobile list rows stacked instead of scrolling tables.
9. Dashboard widgets chosen per role from permissions.
