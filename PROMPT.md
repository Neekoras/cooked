# Cooked — Complete Project Context Prompt

Use this document to fully brief any AI assistant, developer, or collaborator on this project. Everything needed to understand, extend, or debug Cooked is in this file.

---

## What This Project Is

**Cooked** is a Chrome extension (Manifest V3) that plugs into Canvas LMS — the grade management platform used by most US high schools and universities — and solves the inverse grade problem in real time.

Canvas has a native feature called "What-If Grades" that lets students simulate a hypothetical score forward: *"If I get a 90 on this test, what will my grade be?"* This has existed for years. What Canvas has never done — and what students have been requesting on the Canvas Community forums for over six years — is solve the problem in reverse: *"What score do I need on my final exam to end up with a B?"*

That is the exact problem Cooked solves.

The user opens the extension from the Chrome toolbar while on any Canvas grades page. A side panel slides in. It reads their actual grade data from the Canvas REST API using their existing browser session (no login, no OAuth, no API key). It recalculates their current grade from raw assignment data, shows it in the panel, and then lets them type in a target grade. Every remaining ungraded assignment immediately shows the exact score they need to hit that target. There is also a "Panic Mode" that lets a student isolate a single assignment (their final, their last project) and see the score they need on that one thing specifically, assuming they perform at their current average on everything else.

---

## Who Built It and For Whom

Built by **Neekoras** (GitHub: `Neekoras`, email: `nickylin211@gmail.com`), a high school student, for high school and college students who use Canvas and want more control over their grade math than Canvas natively provides. The primary test environment is `sequoia.instructure.com`, a California school district Canvas instance. The extension targets all `*.instructure.com` domains.

---

## Tech Stack — Every Dependency Explained

### Runtime
- **Chrome Extension Manifest V3** — the current Chrome extension standard. Uses `sidePanel` API (not a popup), `tabs` permission to read active tab URL, and `host_permissions` for `https://*.instructure.com/*`
- **React 18** with `createRoot` — the UI is a full React app rendered inside the Chrome Side Panel
- **JSX** compiled by Babel with `@babel/preset-react` using the automatic runtime (no `import React` needed)

### Build
- **Webpack 5** — bundles everything. Two entry points: `background.js` (service worker) and `sidepanel.js` (the React app)
- **Babel** — transpiles JSX and modern JS. Targets Chrome 100+
- **babel-loader** — Webpack loader for Babel
- **css-loader + to-string-loader** — CSS files are imported as JavaScript strings, then injected into the document at runtime via a `<style>` tag. This is required because the side panel is a real browser page (not a content script), so standard CSS injection works normally
- **copy-webpack-plugin** — copies `manifest.json`, `sidepanel.html`, and `src/icons/` into `dist/` at build time
- `clean: true` in webpack output — wipes `dist/` on every build

### No external UI libraries. No Tailwind. No component library. Pure custom CSS.

---

## Project File Structure

```
cooked/
├── manifest.json              # MV3 manifest — source of truth, copied to dist/
├── webpack.config.js          # Build config
├── package.json
├── dist/                      # Built output — load THIS folder into Chrome
│   ├── manifest.json
│   ├── sidepanel.html
│   ├── sidepanel.js           # Full bundled React app (~182KB)
│   ├── background.js          # Service worker (~77 bytes)
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── src/
    ├── sidepanel.html         # HTML shell for the side panel page
    ├── sidepanel.js           # React entry point — renders <App /> into #root
    ├── background.js          # Sets openPanelOnActionClick behavior
    ├── api/
    │   └── canvasClient.js    # All Canvas REST API calls
    ├── math/
    │   └── gradeEngine.js     # Pure grade math — no DOM, no side effects
    ├── styles/
    │   └── base.css           # All UI styles — scoped to .ck-root
    ├── icons/
    │   ├── icon16.png
    │   ├── icon48.png
    │   └── icon128.png        # Gold "C" on near-black background, generated with Python
    └── ui/
        ├── Sidebar.jsx        # Main orchestrator — state, data loading, navigation
        ├── GradeDisplay.jsx   # Large grade % and letter in the header
        ├── TargetInput.jsx    # Text input for target grade (accepts "A-", "B+", "87")
        ├── Breakdown.jsx      # Full assignment group list with inverse result overlay
        ├── PanicMode.jsx      # Single-assignment solver dropdown + result card
        ├── ShareCard.jsx      # DOM preview + Canvas 2D API image generator
        └── CourseList.jsx     # All-courses overview with GPA summary
```

---

## How the Extension Works — Full Flow

### 1. Extension opens
The user clicks the Cooked icon in the Chrome toolbar. `background.js` has registered `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`, so Chrome opens `sidepanel.html` as a native browser side panel — the page content shifts left, the panel appears on the right, no overlay.

### 2. Tab detection
`Sidebar.jsx` immediately calls `chrome.tabs.query({ active: true, currentWindow: true })` to read the URL of the browser tab the user is on. If that URL contains `instructure.com`, it calls `setApiBase(origin)` to configure the Canvas API client with the correct base URL (e.g., `https://sequoia.instructure.com`). It also sets `apiReady = true`, which gates all data fetching. If the user is not on Canvas, the panel shows "Open a Canvas page first."

### 3. Course list fetch
Once `apiReady` is true, the extension calls `GET /api/v1/courses?enrollment_type=student&enrollment_state=active&include[]=total_scores` to get all the student's active courses with current grade scores. This populates the quick-switcher pill buttons at the top of the panel and the All Courses view.

### 4. Course grade fetch
For the active course (either the one in the current tab URL, or the one the user clicks), the extension fires three API calls in parallel:
- `GET /api/v1/courses/:id/assignment_groups?include[]=assignments&include[]=submission&include[]=score_statistics` — gets all assignment groups, all assignments within them, and the student's submission for each (including score)
- `GET /api/v1/courses/:id?include[]=grading_scheme` — gets whether the course uses weighted assignment groups and any custom letter grade cutoffs
- `GET /api/v1/courses/:id/enrollments?user_id=self&type[]=StudentEnrollment` — gets Canvas's own computed grade for discrepancy detection

All three are cached in `courseCache` (a `useRef` object keyed by course ID) so switching between courses is instant after first load.

### 5. Grade calculation
The raw Canvas API data is fed into `gradeEngine.js` which recalculates the grade from scratch:
- Applies `drop_lowest` / `drop_highest` / `never_drop` rules per assignment group
- For weighted courses: `grade = Σ(group_percent × group_weight) / Σ(weights of groups with data)` — this matches Canvas's own normalization behavior for groups with no graded work yet
- For unweighted courses: `grade = total_earned / total_possible`
- Compares result to Canvas's reported grade — if they differ by more than 0.5%, shows a discrepancy warning banner

### 6. Inverse calculation
When the user types a target grade into the input field (accepts letter grades like `A-`, `B+`, `C` or raw percentages like `87`, `91.5`), `solveInverse()` runs:
- For weighted courses: for each group with remaining assignments, calculates what group percentage is needed given the contribution from all other groups, then distributes required points across remaining assignments proportionally by their point value
- For unweighted courses: calculates a uniform required percentage across all remaining assignments
- Results are sorted by due date (soonest first)
- Each assignment shows: required score, required percent, and a chip — "on track" (green, score ≤ 0 needed), "high bar" (yellow, >90% needed), or "not possible" (red, >100% needed)

### 7. Panic Mode
The user selects a single specific assignment from a dropdown (any ungraded assignment across all groups). `solvePanic()` isolates that assignment and solves for it assuming all other remaining assignments score at the student's current overall average (or 75% if no grades exist yet). Returns a single required score/percent for that one assignment.

### 8. Share Card
Generates a downloadable PNG using the browser's Canvas 2D API (no external library). The card shows the student's grade situation as a shareable image styled to match the extension's aesthetic. The DOM preview uses the same text/design; download triggers a canvas render and `link.click()` to save the PNG.

---

## Canvas API Details

**Base URL:** dynamically set from the active tab origin — e.g., `https://sequoia.instructure.com`

**Auth:** `credentials: 'include'` on every fetch — uses the student's existing browser session cookie. No OAuth. No API tokens. The student just has to be logged into Canvas.

**Pagination:** Canvas uses `Link` header pagination. `fetchPaged()` follows `rel="next"` links until all pages are consumed.

**Grading schemes:** Canvas returns the course's custom grading scale when you add `?include[]=grading_scheme` to the course endpoint. The values come back as either decimals (0–1) or percentages (0–100) depending on the Canvas instance. The `normalizeGradingScheme()` function detects which format and normalizes to percent. If the scheme is malformed (top value ≥ 100 after normalization, or nothing above 50%), it falls back to the standard US grade scale.

**Drop rules:** Each assignment group in the Canvas API has a `rules` object: `{ drop_lowest: N, drop_highest: N, never_drop: [id, id, ...] }`. The math engine applies these before computing group scores.

---

## The Math Engine — gradeEngine.js

All functions are pure (no DOM, no imports from browser APIs). Independently testable.

### Key functions:

**`calculateGrade(groups, isWeighted)`**
Takes raw Canvas assignment group data and returns `{ grade, groupResults, isWeighted, totalRemaining }`. Each group in `groupResults` is annotated with `.score` (earned/possible/percent/droppedIds) and `.remaining` (ungraded non-excused assignments).

**`solveInverse(groupResults, targetPercent, isWeighted)`**
The core feature. Given the current state and a target, returns an array of `{ assignmentId, assignmentName, pointsPossible, requiredScore, requiredPercent, isImpossible, isAchieved, dueAt }` objects for every remaining assignment, sorted by due date.

**`solvePanic(groupResults, targetPercent, assignmentId, isWeighted)`**
Single-assignment solver. Assumes other remaining work scores at current average, solves for the selected assignment only.

**`normalizeGradingScheme(scheme)`**
Converts Canvas's grading scheme array into sorted `{ letter, minPct }` entries. Handles both decimal and percentage value formats.

**`percentToLetterWithScheme(pct, scheme)`** / **`letterToPercentWithScheme(input, scheme)`**
Scheme-aware versions of the standard letter/percent converters. Fall back to the US standard scale when no scheme is provided.

**`calcGPA(courses)`**
Takes an array of `{ currentScore, currentGrade }` and returns a GPA number using the standard 4.0 scale with +/- point values. Uses Canvas's own letter grade when available (already scheme-aware) rather than recomputing from raw score.

---

## UI Architecture

### Side Panel Mode (current default)
The extension runs as a Chrome native side panel. `sidepanel.js` is the entry point — it injects styles into the side panel document's `<head>` and renders `<App />` into `#root`. `Sidebar.jsx` receives `embedded={true}`, which means:
- No floating toggle tab button is rendered
- Panel style overrides make it fill 100% width/height rather than using `position: fixed`
- Course switching navigates the browser tab via `chrome.tabs.update()` rather than `window.location.href`
- `apiReady` state gates all data fetching until the tab URL is read

### CSS Scoping
All styles use the `.ck-` prefix. CSS variables are defined on `.ck-root`. There is no Shadow DOM — styles are injected into the side panel document directly, which is a clean context with no risk of Canvas style bleed.

### State Management
No Redux, no Zustand, no context. All state lives in `Sidebar.jsx` and is passed down as props. The most important state:
- `apiReady` — gates all fetching
- `urlCourseId` — parsed from tab URL, drives `activeCourseId`
- `courseData` — `{ status, groups, isWeighted, enrollmentGrade, gradingScheme, error }`
- `courseCache` — `useRef({})` keyed by course ID — prevents re-fetching
- `targetPercent` — drives inverse calculation
- `inverseResults` — computed by `useMemo` from `groupResults + targetPercent`

---

## Design System

### Color Tokens (defined on `.ck-root`)
```css
--bg:         #090B11   /* Base — deep navy-black */
--surface:    #101321   /* Cards, inputs */
--elevated:   #171B2C   /* Hover states */
--overlay:    #1E2238   /* Dropdowns */
--text:       #ECF0F9   /* Primary — near-white */
--text-2:     #7A8099   /* Secondary — muted gray-blue */
--text-3:     #5D6480   /* Tertiary — dim, placeholders only */
--accent:     #C5A348   /* Gold — from icon, used sparingly */
--accent-hi:  #D6B55C   /* Brighter gold for GPA, hover states */
--green:      #4DAF77   /* Success base */
--green-hi:   #6DCE96   /* Success foreground text */
--yellow:     #D4792A   /* Warning base (orange, not yellow) */
--yellow-hi:  #E8954E   /* Warning foreground text */
--red:        #D94F4F   /* Error base */
--red-hi:     #EF7070   /* Error foreground text */
--border:     #1A1E32   /* Subtle dividers */
--border-2:   #252B46   /* Input outlines, card edges */
--border-focus: #C5A348 /* Focus ring (same as accent) */
```

### Typography
- **Display/headings:** Playfair Display, weights 600/700 — wordmark, grade percentage, GPA number, Panic result
- **Body/UI:** DM Sans, weights 300/400/500/600 — everything else
- **Mono:** tabular-nums via `font-variant-numeric` on score/percentage values
- Fonts loaded via `<link>` tag injected into the side panel document's `<head>` pointing to Google Fonts

---

## Known Issues and Edge Cases

1. **Canvas sends grading scheme values as either 0–1 or 0–100** depending on the instance. The `normalizeGradingScheme()` function handles this but if the top threshold is exactly `1.0` (meaning 100%), we multiply by 100 and get 10000%, which breaks. The current fix: if the top normalized value is ≥ 100, fall back to the standard scale.

2. **Unposted/hidden assignments** are not returned by the API and therefore do not appear in Cooked's calculations. This is why Cooked's calculated grade may occasionally differ from Canvas's displayed grade.

3. **Extra credit** (assignments with `points_possible = 0` or scores above `points_possible`) is handled correctly in the current grade calculation (no cap) but the inverse solver marks extra-credit assignments as "not possible" because it cannot guarantee a score above 100%.

4. **The side panel requires the user to already be on a Canvas page** when they open it. If they open it from a non-Canvas tab, `apiReady` never becomes `true` and the panel shows "Open a Canvas page first." Navigating to Canvas after opening the panel will trigger the tab listener and load data automatically.

5. **Race condition previously existed** between `setApiBase()` and the first fetch effect. Fixed by the `apiReady` state gate — no fetch fires until the origin is confirmed.

---

## Build and Load Instructions

```bash
# Install dependencies
npm install

# Production build → dist/
npm run build

# Load in Chrome
# 1. Go to chrome://extensions
# 2. Enable Developer mode (top right)
# 3. Click "Load unpacked"
# 4. Select the dist/ folder (not the root cooked/ folder)
# 5. Navigate to any Canvas grades page
# 6. Click the Cooked icon in the Chrome toolbar
```

To reload after changes: rebuild, then click the reload icon on the Cooked card in `chrome://extensions`.

---

## Repository

GitHub: `https://github.com/Neekoras/cooked`
Owner: Neekoras (nickylin211@gmail.com)
All commits attributed to Neekoras — no Co-Authored-By tags.
