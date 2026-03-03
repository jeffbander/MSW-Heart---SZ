# Statistics Dashboard — UI Overhaul Spec

## Overview
This spec covers a full UI overhaul of the Statistics Dashboard (Practice Overview, Provider Scorecard, Testing Analytics, and Data Upload pages). The goal: a more polished, professional, easy-to-navigate experience with better data density and visual hierarchy.

The existing functionality and data flow stay exactly the same — this is purely a front-end/styling pass.

---

## 1. NAVIGATION — Unified Statistics Sub-Nav

### Problem
Currently, navigating between the three statistics views relies on small buttons in the top-right corner of the Practice Overview page and plain "← Back to Practice Overview" links on sub-pages. It feels disconnected and makes it unclear that these are all part of one Statistics section.

### Solution — Add a Persistent Horizontal Tab Bar
Create a new shared component: `app/components/statistics/StatisticsNav.tsx`

```
┌─────────────────────────────────────────────────────────────────────┐
│  Practice Overview    Provider Scorecard    Testing Analytics       │
│  ═══════════════                                                    │
│                                              [Manage Uploads ↗]    │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Horizontal tab bar sitting directly below the page title area
- Tabs are: **Practice Overview** (`/statistics`), **Provider Scorecard** (`/statistics/providers`), **Testing Analytics** (`/statistics/testing`)
- Active tab has a 2px bottom border in `primaryBlue (#003D7A)` and bold text
- Inactive tabs are `text-gray-500` with `hover:text-gray-700`
- "Manage Uploads" is a small text link (not a tab) aligned to the right side, styled as `text-sm text-gray-400 hover:text-primaryBlue` with a small external-link icon
- The `← Back to Dashboard` link stays above the title on all three pages
- Remove the existing button-style navigation links from the Practice Overview header
- This nav should be used on all three statistics pages (Practice Overview, Provider Scorecard, Testing Analytics)
- **Keep the Payer Mix chart on the Practice Overview page** — payer mix data is integrated into each page, not a separate tab

**Component structure:**
```tsx
// StatisticsNav.tsx
// Props: none (reads pathname via usePathname)
// Renders: <nav> with three Link items + Manage Uploads link
// Active state detection: pathname === '/statistics' for Overview,
//   pathname.startsWith('/statistics/providers') for Providers,
//   pathname.startsWith('/statistics/testing') for Testing
```

---

## 1b. PAYER MIX — Integrated Into Each Page

Payer mix data is integrated directly into each existing statistics page rather than being a separate tab. This lets users see payer mix context alongside the data they're already viewing.

### Practice Overview
- **Keep the existing PayerMixChart** in its current position (side by side with the Trend Chart in a 2-column grid)
- No changes needed to the Practice Overview payer mix — it already shows practice-level payer distribution

### Provider Scorecard — Comparison View (all providers table)
- **Add a "Payer Mix by Provider" section** below the Provider Comparison Table
- Table format: rows = providers, columns = top payer categories (Medicare, Commercial, Medicaid, Self-Pay, Other)
- Each cell shows the percentage (e.g., "42%")
- Include a "Practice Average" row at the bottom for comparison
- Styled as a white card with the same section header treatment (4px left border in `#059669` green)
- Data source: `/api/statistics/payer-mix` with provider-level grouping

### Provider Scorecard — Single Provider View
- **Add a "Payer Mix" section** after the existing sections (Visit Breakdown, Orders, Referrals)
- Layout: Horizontal bar chart showing the provider's payer breakdown (Medicare, Commercial, Medicaid, Self-Pay, Other)
- Next to each bar, show the percentage AND the practice-wide average for comparison
- Example: `Medicare ████████████████░░░░ 42% (Practice Avg: 38%)`
- Styled as a white card section with green left border
- Data source: `/api/statistics/payer-mix` filtered to the selected provider, plus practice-wide averages

### Testing Analytics
- **Add a collapsible "Payer Mix by Department" section** below the existing sections
- Table format: rows = testing departments, columns = top payer categories
- Each cell shows the percentage
- Include a "Total" row at the bottom
- Default state: collapsed (to avoid making the already long page longer)
- Styled consistently with the other collapsible sections on this page
- Data source: `/api/statistics/payer-mix` with department-level grouping

### Data Upload Page
The Data Upload page (`/data`) does NOT get this tab bar. It keeps its current standalone layout since it's an admin/utility page.

---

## 2. PAGE HEADER — Consistent Layout

### Current Problem
Each page has slightly different header styling. The title, filters, and month context label are inconsistently placed.

### Solution
Standardize headers across all three statistics pages:

```
← Back to Dashboard

Practice Overview
═══════════════════════════════════════════════════════════════
Practice Overview  │  Provider Scorecard  │  Testing Analytics        [Manage Uploads ↗]
────────────────────────────────────────────────────────────

┌─ Filters ─────────────────────────────────────────────────┐
│  Month: [January 2026 ▼]    Compare: [vs Previous Month ▼]│
│                              January 2026 vs December 2025 │
└───────────────────────────────────────────────────────────-┘
```

**Details:**
- Page title: `text-2xl font-bold` in primaryBlue, no changes
- StatisticsNav sits directly below the title with no gap (just `mt-1`)
- Filter bar stays as a white card below the nav, with `rounded-xl shadow-sm`
- The comparison label (e.g., "January 2026 vs December 2025") stays on the right side of the filter bar
- Add the **current period label** (e.g., "January 2026" or "YTD through January 2026") as a subtle heading above the KPI cards, keeping the existing `<h2>` but styled as `text-base font-medium text-gray-600` instead of `text-lg font-semibold primaryBlue` — it should be informational, not visually dominant

---

## 3. KPI CARDS — Visual Upgrade

### Current State
Plain white cards with text only. They're functional but look flat and generic.

### Improvements

**3a. Add a Colored Top Accent Border**
Each KPI card gets a thin (3px) colored top border:
- Total Patients Seen → `primaryBlue (#003D7A)`
- New Patient % → `lightBlue (#0078C8)`
- No Show Rate → `#DC2626` (red, since you want this low)
- Late Cancel Rate → `#D97706` (amber, since you want this low)
- Total Scheduled → `teal (#00A3AD)`

Implementation: Add `style={{ borderTop: '3px solid <color>' }}` to the card wrapper div.

**3b. Better Number Formatting**
- The main value should be `text-3xl font-bold` (up from `text-2xl`)
- The comparison delta should show both the number AND the percentage change on a second line:
  - Example: `+142 (+8.3%)` instead of just `+142`
  - For percentage KPIs (No Show Rate, Late Cancel, New Pt%), show `+1.2pp` (percentage points) as it currently does — this is already correct

**3c. Subtle Background on Positive/Negative Changes**
- When comparison is positive (good): the change indicator area gets a `bg-green-50` pill
- When comparison is negative (bad): `bg-red-50` pill
- This makes the direction scannable at a glance
- Implementation: Wrap the comparison span in a small `px-2 py-0.5 rounded-full` container

**3d. For the Provider Scorecard KPI Cards (6-card grid)**
Same improvements apply. The grid is `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` — keep this but make the cards slightly taller with `min-h-[120px]` so they don't feel cramped.

---

## 4. TABLES — Polish and Readability

### 4a. Alternating Row Shading
Add `even:bg-gray-50/50` (very subtle) to table body rows across all tables:
- VisitBreakdownTable
- TestingVolumeSummary
- Provider Comparison Table
- Testing Analytics department table
- All orders/referrals tables

### 4b. Sticky Table Headers
For the Provider Comparison Table specifically (which can be wide and has many rows):
- Make the `<thead>` sticky: `className="sticky top-0 z-10"`
- This ensures column labels stay visible when scrolling

### 4c. Table Section Headers
Add a subtle left-colored border to table section titles (the `<h3>` inside the `px-5 py-4 border-b` header):
- Office Visit Breakdown → 4px left border in `primaryBlue`
- Testing Volume → 4px left border in `teal`
- Orders by Category → 4px left border in `lightBlue`
- Payer Mix → 4px left border in `#059669` (green)
- Referrals → 4px left border in `#7C3AED` (purple)

Implementation: Add `style={{ borderLeft: '4px solid <color>' }}` and `pl-4` to the header div.

### 4d. Totals Row Styling
The totals/average rows at the bottom of tables (Testing Volume, Provider Comparison) should have:
- `bg-gray-100` (slightly stronger than current `bg-gray-50`)
- A `border-t-2 border-gray-300` (slightly stronger separator)
- The "Total" or "Average" label in `font-bold` (not just `font-semibold`)

### 4e. Expandable Row Visual Cues
The expand/collapse arrows (▶/▼) should be slightly larger and have a hover effect:
- Replace text arrows with a proper chevron SVG: a small `w-4 h-4` SVG icon that rotates on expand
- The expandable row should have a subtle left-border indicator: `border-l-2 border-primaryBlue/30` when expanded
- Sub-rows (the children when expanded) should have `border-l-2 border-primaryBlue/20 ml-2` for visual grouping

---

## 5. PROVIDER COMPARISON TABLE — Density Improvements

### Current Problem
The table has 9 columns which can feel cramped, especially with comparison change values shown below each number.

### Improvements

**5a. Compact Mode**
- Reduce cell padding from `px-4 py-3` to `px-3 py-2.5`
- Reduce font size of the change delta values from `text-xs` to `text-[10px]`
- This gains meaningful horizontal space

**5b. Color-Coded Cell Backgrounds**
Keep the existing green/red cell coloring (20% above/below average) but make it more subtle:
- `bg-green-50/70 text-green-800` (was `bg-green-50 text-green-700`)
- `bg-red-50/70 text-red-800` (was `bg-red-50 text-red-700`)

**5c. Provider Name Column**
- Make provider names `font-semibold` and `text-primaryBlue` with underline on hover
- Add the provider's initials as a small `w-6 h-6 rounded-full bg-primaryBlue/10 text-primaryBlue text-xs flex items-center justify-center` avatar circle before the name

**5d. Average Row**
- Style it as a pinned footer: `sticky bottom-0` so it's always visible when scrolling
- Background: `bg-blue-50/80 backdrop-blur-sm` for a frosted effect

---

## 6. PROVIDER SCORECARD (Single Provider View) — Layout

### Improvements

**6a. Provider Header Card**
Instead of just the name and date as plain text, wrap the provider info in a card:
```
┌──────────────────────────────────────────────┐
│  [SZ]  Dr. Sarah Zhang                       │
│        January 2026 · vs Previous Month      │
└──────────────────────────────────────────────┘
```
- Circular avatar with initials (`w-12 h-12 rounded-full bg-primaryBlue text-white font-bold flex items-center justify-center`)
- Provider name as `text-xl font-bold text-primaryBlue`
- Period info as `text-sm text-gray-500`
- Wrap in a white card: `bg-white rounded-xl shadow-sm p-5 flex items-center gap-4`

**6b. Section Spacing**
- Increase `space-y-6` to `space-y-8` between major sections (KPI cards, Visit Breakdown, Orders, Referrals)
- This gives the page more breathing room

---

## 7. TESTING ANALYTICS — Collapsible Sections

### Current Problem
The Testing Analytics page is very long with three major sections stacked vertically (Department Volume, Orders Into Department, Referrals on Completed Studies). Users have to scroll a lot.

### Improvements

**7a. Collapsible Section Cards**
Each of the three major sections should be collapsible:
- Click the section header to expand/collapse
- Default: first section expanded, other two collapsed
- Store expand/collapse state locally (useState, not localStorage)
- Header shows a chevron icon and section title
- When collapsed, show a 1-line summary: e.g., "7 departments · 4,231 completed tests"

**7b. Department KPI Summary Cards**
Before the detailed table, add a row of small summary cards for the top departments:
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ CVI Echo    │ │ Echo Lab    │ │ Vascular    │ │ Nuclear     │
│    1,842    │ │      934    │ │      687    │ │      412    │
│   +12.3%    │ │    -2.1%    │ │    +5.7%    │ │    +0.3%    │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```
- Grid: `grid-cols-2 md:grid-cols-4 lg:grid-cols-7`
- Each card shows: department name, completed count, % change vs comparison
- Same accent-border styling as the main KPI cards but in `teal` color

---

## 8. PAYER MIX & TREND CHARTS — Visual Polish

### 8a. Payer Mix Chart
- Increase donut inner radius from 50 to 60 for a sleeker look
- Add the total count in the center of the donut: `<text>` element positioned at center showing total visits count
- The legend table on the right: add alternating row shading

### 8b. Trend Chart
- Add a subtle gradient fill below the line (area chart feel) using `<defs>` and `<linearGradient>` in recharts
- When showing multiple lines (by visit type, by department), use distinct line styles: solid for the first series, dashed for secondary ones
- Increase the chart height from `h-72` to `h-80` for more room

---

## 9. DATA UPLOAD PAGE — Minor Polish

### 9a. Upload Zones
- Add a subtle icon for each report type inside the drop zone (office building for Office, monitor for Testing, clipboard for Orders) — use the existing icons already defined in the parent component
- When all files in a group are uploaded successfully, show a subtle green border on the group card

### 9b. Upload History Table
- Add alternating row shading: `even:bg-gray-50/50`
- Add a "Report Month" column (showing the month the data covers) — this is already in the data but not displayed as its own column (currently the file name shows)
- Group rows by report month with a subtle separator between months

---

## 10. GLOBAL STYLING TWEAKS

### 10a. Card Shadows
Upgrade from `shadow-sm` to `shadow-md` for main content cards. Keep `shadow-sm` for KPI cards and inner elements.

### 10b. Transition & Hover Effects
- All clickable table rows: add `transition-colors duration-150`
- Card hover: `hover:shadow-lg transition-shadow duration-200` on main section cards
- Expand/collapse transitions: use `transition-all duration-200` for smooth open/close animations

### 10c. Loading States
Replace plain "Loading..." text with a proper skeleton loader pattern:
- For KPI cards: show 5 gray pulsing rectangles (`animate-pulse bg-gray-200 rounded`)
- For tables: show 5-6 rows of pulsing bars
- Keep it simple — just `div` elements with `animate-pulse`, no fancy libraries

### 10d. Empty States
Add subtle illustrations to empty states:
- "No data uploaded yet" → add a simple SVG icon (upload cloud) above the text, in `text-gray-300` at `w-16 h-16`
- "No provider data available" → chart/bar icon in gray

### 10e. Print-Friendly
Add `@media print` styles:
- Hide the sidebar, navigation tabs, filter bars
- Remove shadows and rounded corners
- Full-width tables
- This allows users to print/PDF reports directly from the browser

---

## Implementation Order

1. **StatisticsNav component** — Create the shared nav, integrate into all 3 statistics pages
2. **KPI Card upgrades** — Accent borders, larger numbers, change pills
3. **Table polish** — Alternating rows, sticky headers, section borders, expand/collapse icons
4. **Provider Comparison Table** — Compact mode, avatar initials, sticky average row, add "Payer Mix by Provider" table
5. **Provider Scorecard** — Header card, section spacing, add per-provider payer mix bar chart with vs-practice-average
6. **Testing Analytics** — Collapsible sections, summary KPI cards, add collapsible "Payer Mix by Department" table
7. **Chart improvements** — Donut center text, trend gradient, legend polish
8. **Data Upload polish** — History grouping, report month column
9. **Global** — Shadows, transitions, loading skeletons, print styles

---

## Files to Modify

| File | Changes |
|------|---------|
| **NEW** `app/components/statistics/StatisticsNav.tsx` | Create shared navigation component (3 tabs + Manage Uploads) |
| `app/statistics/page.tsx` | Add StatisticsNav, remove old nav buttons, KEEP payer mix chart alongside trend chart |
| `app/statistics/providers/page.tsx` | Add StatisticsNav, adjust header layout, add "Payer Mix by Provider" table (comparison view) and per-provider payer mix bar chart (scorecard view) |
| `app/statistics/testing/page.tsx` | Add StatisticsNav, collapsible sections, summary cards, add collapsible "Payer Mix by Department" table |
| `app/components/statistics/KPICard.tsx` | Accent border, larger value, change pill styling |
| `app/components/statistics/VisitBreakdownTable.tsx` | Alternating rows, expand icons, section border |
| `app/components/statistics/TestingVolumeSummary.tsx` | Alternating rows, section border |
| `app/components/statistics/ProviderComparisonTable.tsx` | Compact padding, sticky header/footer, initials avatar |
| `app/components/statistics/ProviderScorecard.tsx` | Provider header card, section spacing, expand icons |
| `app/components/statistics/PayerMixChart.tsx` | Donut center text, legend shading |
| `app/components/statistics/TrendChart.tsx` | Gradient fill, chart height |
| `app/data/page.tsx` | History grouping, report month column, alternating rows |

## Color Reference
- primaryBlue: `#003D7A`
- lightBlue: `#0078C8`
- teal: `#00A3AD`
- lightGray: `#F5F5F5`
- green: `#059669`
- red: `#DC2626`
- amber: `#D97706`
- purple: `#7C3AED`
