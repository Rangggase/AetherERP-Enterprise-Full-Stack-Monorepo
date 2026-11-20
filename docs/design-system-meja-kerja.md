# Design system v3: "meja kerja akuntan" (the accountant's desk)

Scope: the visual and interaction layer of `frontend/` only. Backend, API contracts, business logic (returns, FIFO, journals, account classification), the 16 permissions, validation rules, data and what every button does stay as they are. The previous system is kept as `design-system-v2.md` ("kertas dan tinta"), and v1 as `design-system-v1.md`.

Reference implementation of every token and component in every state: `docs/prototypes/tactile-kit.html` (with `tactile-kit.css`, `tactile-kit.js`). Glyph catalogue: `docs/prototypes/glyphs.html`. Recordings: `docs/recordings/tactile-*.webm`.

## Direction

Every element is an object on a desk: a sheet of paper, a cash-register key, a folder tab, an ink stamp, a receipt slip. Objects have depth from one light source above, and they answer to touch and to time. The result stays calm and professional: depth is shallow, motion is short, colour is the same paper and ink as v2.

1. **Objects, not decoration.** Depth says what is a sheet, what is lifted, what is pressed in. Nothing glows, nothing is a gradient, nothing is neon.
2. **One accent.** Oxblood `#7A2E2A` marks the primary action, the active item and the main data series.
3. **Glyph and word together.** Custom line glyphs sit beside words, never instead of them (one exception: the sidebar rail, where the word is the tooltip and the accessible name).
4. **Motion confirms.** A key goes down, a stamp lands, a line draws once. Motion never loops except a loading indicator.
5. **Status is never colour alone.** Badges and stamps carry a word; racks carry a SKU and a word.

## B. Foundations

### B1. Depth model (one light source from above)

Tokens in `frontend/src/index.css`:

| Level | Token | Value | Use |
| --- | --- | --- | --- |
| 0 canvas | `--elev-0` | none, background `#F4F1EA` | Page |
| 1 sheet | `--elev-1` | `0 1px 0 rgba(30,27,24,.06)`, background `#FBFAF6`, 1px `#DCD6CA` border | Panels, tables, forms |
| 2 lifted | `--elev-2` | level 1 plus `0 6px 14px -6px rgba(30,27,24,.18)` | Hover, selected item, task card |
| 3 layer | `--elev-3` | `0 16px 40px -12px rgba(30,27,24,.30)` | Drawer, dialog, menu, palette, toast |
| pressed in | `--inset` | `inset 0 1px 2px rgba(30,27,24,.10)`, background `#EFEBE2` | Inputs, switch rail, segmented control |
| paper stack | `--stack-1`, `--stack-2` | sheets behind, offset 3px and 6px | Cards that stand for a collection |

A lifted sheet paints in three layers inside its own stacking context: paper behind (-3), shadow (-2), face (-1), then content. The elevation change animates the shadow layer's opacity, never `box-shadow` itself. Stack count follows the item count: 1 item one sheet, 2 items two sheets, 3 or more three sheets.

### B2. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--t-press` | 90ms | Key press |
| `--t-fast` | 140ms | Hover, focus, chip, menu, switch |
| `--t-mid` | 220ms | Drawer, dialog, tab panel, stagger item, stamp |
| `--t-slow` | 360ms | Large layout moves (not used yet) |
| `--t-draw` | 600ms | A chart line drawing |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | Entrances |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` | Exits |
| `--ease-spring` | `cubic-bezier(.3,1.35,.5,1)` | Key press, stamp, switch knob, radio dot |

Rules:

- Only `transform`, `opacity`, colour and `stroke-dashoffset` animate. Never width, height, top or left.
- Nothing loops except a loading indicator (key progress bar, skeleton sheen).
- Choreography: items of one group enter 30ms apart, at most 6 staggered; the rest arrive with the sixth.
- Numbers change with a crossfade and a 4px shift; there is no count-up.
- `prefers-reduced-motion: reduce` removes every position, scale, shake and parallax movement. Colour, opacity and glyph changes stay, so a pressed key still loses its edge and darkens, and a success still shows its tick.

### B3. Glyphs

- Custom line set, not a general icon library: 24 grid, 1.5px stroke, round caps and joins, no fill, `currentColor`.
- Module glyphs, one per route: Dasbor, Pesanan pembelian, Penerimaan barang, Pemasok, Produk, Level stok, Kartu stok, Transfer antar gudang, Perakitan, Saran pesan ulang, Pesanan penjualan, Pengiriman, Faktur, Retur, Pelanggan, Jurnal, Buku besar, Laporan, Periode, Log audit, Pengguna, Pengaturan, Akun. (Pengiriman, Buku besar and Pengaturan have no route of their own; the glyphs exist for completeness.)
- Action glyphs: simpan (tick), buat (plus), kirim (arrow), retur (U-turn), cetak, ekspor, hapus, edit, filter, urutkan, tutup, peringatan, berhasil, gagal, gembok, cari, naik, turun, lainnya, cabang, rel, keluar, buka lengkap.
- Always beside a word and `aria-hidden`. Sizes 16 (badges, dense rows), 20 (keys, menus), 24 (rail, mobile tab bar).
- React components: `frontend/src/components/glyphs/`.

### Colour

Fixed palette: canvas `#F4F1EA`, surface `#FBFAF6`, ink `#1E1B18`, muted `#6B645A`, line `#DCD6CA`, accent `#7A2E2A`, accent deep `#5A201D`, highlight `#EFEBE2`, good `#3F6B4E`, warn `#B07A1E`, bad `#9E3B32`, info `#3D5A73`.

Two helpers stay from v2 for contrast: warning text `#8A5F12` (`#B07A1E` is 3.3:1 as text) and control borders `#8C8478` (`#DCD6CA` is 1.3:1). The secondary key's bottom edge `#C9C2B4` is decorative; the key is identified by its word and its 1px border.

Status colours (existing statuses only):

| Colour | Statuses |
| --- | --- |
| good | Lunas, Diterima, Selesai, Terposting, Aktif |
| warn (text `#8A5F12`) | Perlu persetujuan, Diterima sebagian, Dibayar sebagian |
| info | Disetujui, Terkonfirmasi, Terkirim, Ditagih, Terfaktur, Terbuka, Dalam perjalanan |
| bad | Dibalik, Dibatalkan |
| muted | Draf, Penawaran, Diminta, Ditutup |

### Typography

Source Serif 4 (500, 600) for titles, document numbers, headline figures and counts. IBM Plex Sans (400, 500, 600) for everything else; numbers use `tabular-nums lining-nums`. Sizes as v2: figure 56/60 (44 mobile), title 30/36 (26 mobile), document number 22/28, section label 13/20 semibold, body 14/22, table 13/20, caption 12/16. Stamps are the only uppercase text.

### Space and radius

8px grid (4, 8, 16, 24, 32, 40, 48). Radius 4px for sheets, keys, inputs and dialogs; 14px for chips; 50% for the avatar, switch and radio.

## C. Components

Each component has the states normal, hover, pressed, focus, disabled, loading, success and error where they apply.

| Component | Rules |
| --- | --- |
| C1 Primary key | Body accent, 3px bottom edge `#5A201D`, text surface. Glyph in a darker cap on the left. Hover up 1px. Pressed down 3px with the edge gone (90ms, spring). Loading: label replaced by a progress bar inside the key, same width, no double submit. Success: the cap's glyph becomes a tick drawn in 300ms, back after 1.5s. Error: two horizontal shakes (4px max), glyph becomes "!". These states follow the real request (the mutation's pending, success and error), never a timer. |
| C1 Secondary key | Body surface, 1px line border, 2px bottom edge `#C9C2B4`, cap in highlight. |
| C1 Danger key | Like secondary, text and border bad. The action opens a dialog that states the consequence. |
| C1 Text action | Glyph plus word, no relief, underline on hover. Used in table rows and toolbars. |
| C2 Field | Pressed in (`--inset`, highlight background, `#8C8478` border). On focus it rises to the surface: inset gone, border accent, 2px focus ring. Label above, hint below; an error adds a bad border, a warning glyph and a sentence on how to fix it. Native select and date use the light colour scheme. |
| C2 Number | Stepper: two small keys (− and +) around a right-aligned tabular figure; arrow keys step; the keys disable at the limits. |
| C3 Checkbox | Pressed-in box; when checked the tick draws in 160ms. |
| C3 Radio | The dot is pressed into the circle (scale with spring). |
| C3 Switch | Raised knob that slides on a pressed-in rail; `role="switch"`, state word beside it. |
| C4 Tabs | Folder tabs: the active tab joins the panel with no rule between; others sit 3px lower on highlight. Panel change: 8px shift with a 220ms crossfade. Arrow keys move. |
| C5 Badge | In tables: glyph plus word on a 10% tint of the status colour. |
| C5 Stamp | On a document: uppercase word in a double rule, status colour, rotated −4°, a light static SVG ink filter. It is stamped (scale 1.15 → 1, spring, 220ms) only when the status changes during this session; a page opened normally shows it still. |
| C6 Sheet and task card | A panel is a level 1 sheet; no card inside a card. A task card is a paper stack (1–3 sheets by count); hover lifts it to level 2 and fans the stack. A task card opens the filtered list. |
| C7 Table | Sticky header with a shadow that appears only once the table scrolls. Ledger rules. Numbers right-aligned. Row hover: highlight and a 2px accent left rule. Click or Enter opens the preview drawer; "Buka lengkap" inside. Row checkboxes show a bulk bar from below the table, for actions that already exist per row (print, export). Density nyaman/rapat in `localStorage`. Filter chips enter and leave with scale and fade. Mobile: first column sticky, edge shadow, swipe hint. |
| C8 Drawer | From the right, 220ms, backdrop dims, Escape closes, focus stays inside and returns to the trigger. |
| C8 Dialog | Level 3 sheet, scale 0.98 → 1. A risky dialog states the consequence in one sentence and uses the danger key. |
| C8 Menu | Drops 4px with a fade; arrow keys, Escape returns focus. |
| C8 Toast | A receipt slip from the top right with a torn bottom edge (`clip-path`), gone after 4s (paused on hover), closable, announced with `aria-live`. |
| C9 Skeleton | Copies the layout with a very soft paper sheen; no spinners. |
| C9 States | Empty: a small isometric line illustration in `#6B645A`, 1px (empty rack, empty folder, empty receipt), one sentence, one action. Error: torn paper, what happened, "Coba lagi". No access: line padlock and the permission the page needs. |
| C10 Chart | Uses the dataviz method. The line draws once when it first becomes visible (600ms); range changes crossfade values without redrawing. Hover or arrow keys: vertical crosshair and a slip-shaped tooltip. Direct labels at line ends, minimal gridlines, accent main series and muted dashed comparison, a legend for two series, "Lihat sebagai tabel" always. No data: the empty state, never empty axes. |
| C11 KPI | Large serif figure, a 6-month sparkline below, change with an arrow glyph and words ("naik 12% dari Oktober"). A changed value crossfades with a 4px shift. |
| C12 Command palette | Ctrl+K (or ⌘K) opens a level 3 sheet at the top centre. Searches pages, documents (SO, PO, invoice numbers) and actions ("Buat retur"), grouped with glyphs. Arrows and Enter. "/" opens it for pages only. |

## D. Application frame

- **D1 Sidebar.** Wide (224px: glyph and word, lowercase muted group labels) or rail (56px: glyph only, word as tooltip and accessible name); the choice is stored in `localStorage`. One bookmark ribbon marks the active item and slides to it (transform, 220ms). An item with pending work shows a count (wide) or a dot (rail) when the existing API provides the number. Arrow up/down move between items, Enter opens.
- **D2 Top bar.** Breadcrumb; branch selector as a chip that opens a menu; accounting period as a small stamp ("Periode Nov 2026 · Terbuka" green, "Ditutup" muted with a padlock); a search field that opens the palette; the user's initials in a raised circle with a menu.
- **D3 Mobile (below 800px).** The sidebar becomes a bottom tab bar with four main modules chosen from the role's permissions plus "Lainnya", which opens a sheet from the bottom. The page's primary key sticks above the tab bar. Touch targets at least 44px.

## E. Pages

- **Login:** two columns, the form on a sheet at the left; an isometric line illustration (open ledger and warehouse rack) at the right with a subtle cursor parallax (6px max, off with reduced motion). Mobile: a small illustration above the form.
- **Dashboard:** by role from permissions. Order: stacked "Perlu tindakan" cards, one large KPI with smaller supporting figures, the chart, then a mini isometric warehouse plan when stock data exists. Returns have no status, so the returns card is informational.
- **Lists:** one pattern. Serif title with the count, one primary key, filter chips, the C7 table, the preview drawer.
- **Document detail:** the document as real paper (letterhead, number, date, parties), the status stamp, a stage rail built from existing statuses with a marker on the current stage, folder tabs Item, Jurnal, Riwayat, actions by status and permission.
- **Forms (including returns):** sections as stacked sheets with small titles, steppers for quantities, a receipt-shaped summary bar stuck to the bottom showing the system-computed figures. The return's stock cost (FIFO) is only known after posting, because the API has no preview: the receipt says "dihitung sistem saat dicatat" and then shows the figure from the server's response. Receipt figures crossfade. The submit key goes loading → success.
- **Level stok:** isometric warehouse plan (racks coloured by status with SKU and word, quantity on hover or focus). Mobile: the list.
- **Kartu stok, Jurnal:** ledger view with thin rules.
- **Laporan keuangan:** ledger paper; serif title, thin rules, a single rule above subtotals and a double rule under totals. Account column sticky on mobile.
- **Pengguna, Akun saya:** forms with physical switches and a raised initials avatar.
- **Print (invoice, reports):** a print stylesheet with no shadows or motion, black on white, like a paper invoice.

## Accessibility and performance

- Text contrast at least 4.5:1 in every component state; glyphs and control borders at least 3:1 (measured table in `docs/progress-tactile.md` and the final report).
- Focus is always visible and never covered by a shadow (rings use `outline`).
- Touch targets at least 44px below 800px.
- No layout shift from motion or loading (keys reserve their edge with a margin; skeletons copy the layout). CLS below 0.1 on dashboard and lists.
- Animate only transform and opacity on the hot path; filters (the stamp's ink) are static.
- CSS and JS each grow at most 25% over the v2 build (CSS 27,929 B; JS 790,633 B).

## Language

Indonesian UI, server messages as received. Sentence case, active voice, labels name the object. `id-ID` number formatting. Codes are never translated.

## Changes that approach behaviour (to approve)

1. Preview drawer on list rows (kept from v2, now 220ms).
2. Command palette with an "Aksi" group in addition to pages and documents.
3. Mobile bottom tab bar replacing the slide-in menu.
4. Mobile tables: sticky first column with horizontal scroll instead of stacked rows.
5. Row checkboxes and a bulk bar for print and export only.
6. Sidebar rail mode stored in `localStorage`.
7. Login parallax illustration.
