# Cooked — Complete Project Prompt

> Use this file as context for any AI session working on this codebase. It describes the full project: what it is, why it exists, how it works architecturally, how the math works, what every file does, and what design decisions have been made. Read it before touching anything.

---

## What This Project Is

**Cooked** is a Chrome extension (Manifest V3) that solves the one question every student has at the end of a semester: *"What do I need on my final to get a B?"* It plugs into Canvas LMS — the most widely used academic learning management system in the US — and answers that question instantly, in real time, using the student's existing browser session. No login. No API keys. No account creation. No permissions popup. It just works.

Canvas has a built-in "What-If Grades" tool. It lets students simulate *forward* — plug in a hypothetical score and see what their grade would be. What it has never done, despite being the most-requested feature on the Canvas Community forums for over six consecutive years, is solve the problem *in reverse*: given a target grade, what score do you actually need on each remaining assignment? That is the question that matters to students. Cooked answers it.

The extension runs entirely in the browser. Every calculation happens locally. No data ever leaves the user's machine. Canvas's REST API is accessed using the student's existing browser session cookie (`credentials: include`), so the extension has exactly the same access the student already has in their browser — nothing more.

---

## Architecture Overview

### Execution Model

The extension uses Chrome's **Side Panel API** (MV3). When the student clicks the extension icon in the Chrome toolbar, a native browser side panel slides open to the right of the active tab. The side panel is a fully isolated HTML page (`sidepanel.html`) — it does not inject content into Canvas at all. It is Chrome-managed, not DOM-injected.

This architectural choice has an important implication: **the side panel has no Canvas origin**. It runs on `chrome-extension://...`, not `https://school.instructure.com`. This means:
- It cannot use relative URLs to hit the Canvas API.
- It must read the active tab's URL via `chrome.tabs` to discover the school's Canvas domain.
- All API calls are gated behind an `apiReady` flag that only flips once the tab URL has been read and `setApiBase()` has been called with the origin.

### File Structure

```
cooked/
├── manifest.json              # MV3 manifest — permissions, side panel registration, CSP
├── webpack.config.js          # Builds background.js + sidepanel.js → dist/
├── src/
│   ├── background.js          # Service worker: enables side panel on icon click
│   ├── content.js             # Legacy content-script entry (unused in current build)
│   ├── sidepanel.html         # Side panel shell HTML — loads Google Fonts, mounts React root
│   ├── sidepanel.js           # React entry point — injects CSS string, renders <App />
│   ├── api/
│   │   └── canvasClient.js    # All Canvas REST API calls — pagination, session auth, base URL
│   ├── math/
│   │   └── gradeEngine.js     # All grade math — pure JS, zero dependencies, no DOM
│   ├── styles/
│   │   └── base.css           # Full UI stylesheet — scoped to .ck-root, design tokens
│   ├── icons/                 # Extension icons (16/48/128px PNG)
│   └── ui/
│       ├── Sidebar.jsx        # Main shell — state, data loading, routing, tab navigation
│       ├── GradeDisplay.jsx   # Grade header — percentage, letter, discrepancy detection
│       ├── TargetInput.jsx    # Target grade input — parses letters and raw percentages
│       ├── Breakdown.jsx      # Assignment group list with inverse score chips per row
│       ├── PanicMode.jsx      # Single-assignment panic solver with dropdown
│       ├── CourseList.jsx     # All-courses view with grades and GPA calculation
│       └── ShareCard.jsx      # PNG card generator using the browser Canvas 2D API
```

### Build System

Webpack 5 + Babel. Two entry points:
- `background` — the service worker, minified to a single tiny file
- `sidepanel` — the full React app, ~186KB minified

CSS is bundled using `to-string-loader` + `css-loader`: the stylesheet is inlined as a JS string and injected at runtime into a `<style>` element inside the side panel's shadow root (or document head). This prevents any CSS from leaking into Canvas pages.

The `dist/` directory is gitignored. Build with `npm run build` and load `dist/` as an unpacked extension in Chrome.

---

## Canvas API Layer (`canvasClient.js`)

### Session Auth

All requests use `credentials: 'include'`. Canvas sets a session cookie when the student logs in. The extension reuses that cookie — same as any other tab on that domain. No OAuth handshake. No API key management.

### Base URL

The side panel doesn't know which school the student is on. On mount, `Sidebar.jsx` calls `chrome.tabs.query({ active: true, currentWindow: true })` to get the active tab's URL, extracts the origin (e.g. `https://sequoia.instructure.com`), validates it against the regex `/^https:\/\/[^/]+\.instructure\.com$/`, and calls `setApiBase(origin)`. Every subsequent API call prepends `_base` to the path.

### Pagination

Canvas uses Link header pagination. `fetchPaged(url)` follows `rel="next"` links until all pages are collected. `PER_PAGE = 100` for efficiency.

### Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/courses/:id/assignment_groups?include[]=assignments&include[]=submission&include[]=score_statistics` | All assignment groups + student submissions + class averages |
| `GET /api/v1/courses/:id?include[]=grading_scheme` | Course metadata: weighted flag, custom letter grade cutoffs |
| `GET /api/v1/courses/:id/enrollments?user_id=self&type[]=StudentEnrollment` | Canvas's own computed grade (for discrepancy detection) |
| `GET /api/v1/courses?enrollment_type=student&enrollment_state=active&include[]=total_scores` | All active courses with enrollment scores (for course list + GPA) |

All four requests for a single course (`fetchAssignmentGroups`, `fetchCourse`, `fetchEnrollmentGrade`) are fired in parallel via `Promise.all` in `loadCourseData()`.

---

## Grade Engine (`gradeEngine.js`)

This is the core of the extension. Pure JavaScript. Zero dependencies. No DOM references. Every function is independently testable.

### Assignment Classification

Three classification functions:

**`isGraded(assignment)`** — true when the assignment has a real numeric score: `workflow_state === 'graded'` AND `score !== null`. Excused assignments return false and are completely excluded from all calculations (neither graded nor ungraded — they don't exist).

**`isRemaining(assignment)`** — true when the assignment is ungraded, not excused, and has `points_possible > 0`. These are the actionable assignments the inverse solver targets.

**`isPanicEligible(assignment)`** — broader filter for Panic Mode's dropdown. Includes all `isRemaining` assignments PLUS auto-graded-zero missing assignments: assignments where `workflow_state === 'graded'` AND `score === 0` AND (`missing === true` OR `late_policy_status === 'missing'`). The `&&` (not `||`) is critical — without it, any legitimately 0-scored assignment would appear in the dropdown.

### Drop Rules

`applyDropRules(gradedAssignments, rules)` implements Canvas's drop-lowest and drop-highest logic:
- Assignments in `rules.never_drop` are immune.
- Extra credit assignments (`points_possible === 0`) are never dropped and rank highest.
- `drop_lowest` removes the N lowest-scoring assignments (by percentage).
- `drop_highest` removes the N highest-scoring assignments.
- Both rules can coexist.

Dropped assignments still appear in the Breakdown view with a "dropped" badge but are excluded from all calculations.

### Current Grade Calculation

**Unweighted courses** — simple total points:
```
grade = Σ(earned) / Σ(possible) × 100
```

**Weighted courses** — Canvas normalizes by the sum of weights of groups that have graded data, not by 100. This matches Canvas's own normalization behavior and is why a student's grade looks inflated early in the semester when some groups have no data yet:
```
effectiveTotalWeight = Σ(group_weight for groups with graded data)
grade = Σ(group_percent × group_weight) / effectiveTotalWeight × 100
```

### Inverse Calculation (`solveInverse`)

Given a target overall percentage `T` and the current state of all groups, compute the required score on each remaining assignment.

**Weighted courses:**

For each group with remaining assignments:
1. Compute `effectiveTotalWeight` = sum of weights of groups that have data OR are this group (Canvas will include this group once work is submitted).
2. Compute `otherContrib` = sum of contributions from all *other* groups: `Σ(group_percent/100 × group_weight/effectiveTotalWeight)`.
3. `requiredGroupPct = (T/100 - otherContrib) / (group_weight/effectiveTotalWeight)`
4. Within the group, the required total earned = `requiredGroupPct × (score.possible + remainingPossible)`.
5. Needed on remaining = `requiredTotalEarned - score.earned`.
6. Distribute across remaining assignments proportionally by `points_possible`.

**Unweighted courses:**

1. Compute `neededOnAll = target × (totalPossible + totalRemainingPossible) - totalEarned`.
2. `neededPct = neededOnAll / totalRemainingPossible`.
3. Each remaining assignment needs `neededPct × a.points_possible`.

Each result is tagged `isAchieved` (needed ≤ 0 — already on track), `isImpossible` (needed > points_possible × 1.001 — requires more than 100%).

### Panic Mode Solver (`solvePanic`)

Isolates a single assignment. Every other ungraded assignment in the course is assumed to score at the student's current group average (or 75% as a fallback when there is no graded data at all).

For auto-graded-zero missing assignments (already in `score.earned`/`score.possible`): the solver backs out the assignment's contribution from the group totals before computing the fallback average.

```
fallbackPct = basePossible > 0 ? baseEarned / basePossible : 0.75
```

Note: The `basePossible > 0` check is the *only* guard. A previous version had a second guard (`groupAvgPct > 0 ? groupAvgPct : 0.75`) that would incorrectly replace a real 0% average with 75%. A student who has genuinely scored 0% on everything shouldn't get a more optimistic projection.

### Shared Helper: `computeGroupWeighting`

Both `solveInverse` and `solvePanic` need the same two values:
- `effectiveTotalWeight` — Canvas normalization denominator
- `otherContrib` — contributions from all groups except the anchor

These were previously duplicated. They are now centralized in `computeGroupWeighting(groupResults, anchorGroupId)`.

### Grading Schemes

Canvas lets each course define custom letter grade cutoffs. Some schools use a 10-point scale (90=A), others use 93+, others have completely custom breakpoints.

`normalizeGradingScheme(scheme)` handles two Canvas response formats:
- Values as 0–1 decimals (most common): `value * 100`
- Values as 0–100 percentages (some Canvas instances): used as-is

Detection: if `maxVal > 1`, values are already percentages. The function also rejects malformed schemes (top threshold ≥ 100 after normalization, or no entry above 50%) and falls back to the standard US scale.

`percentToLetterWithScheme` and `letterToPercentWithScheme` use the normalized scheme for all letter grade resolution throughout the app.

### GPA Calculation

Each course contributes using Canvas's own letter grade (`currentGrade`) when available, falling back to `percentToGPA(currentScore)`. This ensures Canvas's own grade-rounding (including custom grading schemes) is respected.

GPA is a simple unweighted average. No credit hours — Canvas doesn't expose them.

---

## React Application (`src/ui/`)

### Sidebar.jsx — Main Shell

The entire application state lives here. Responsibilities:
- Reads active tab URL on mount (`chrome.tabs.query`), sets `apiReady` flag
- Listens for tab navigation (`chrome.tabs.onUpdated`) to track course changes
- Manages navigation state: `view` (`'course'` | `'courses'`), `activeCourseId`, `activeTab`, `targetPercent`
- Loads and caches course data in `courseCache` ref (switching between already-loaded courses is instant)
- Uses a request ID ref (`loadRequestRef`) to discard stale API responses when the user switches courses quickly
- Computes `grade` and `groupResults` via `calculateGrade` (useMemo)
- Computes `inverseResults` via `solveInverse` (useMemo)
- Handles course selection with `handleCourseSelect` (useCallback): validates numeric IDs, navigates the browser tab to the selected course's grades page

**Panel modes:**
- Overlay mode (content script): renders a fixed-position slide-out panel with a toggle tab
- Embedded mode (side panel): fills 100% width/height, no toggle tab, no border/shadow

**Tab panel ARIA:** Tab buttons have `aria-controls`, `aria-selected`, `id`. Tab panels have `role="tabpanel"`, `aria-labelledby`, `hidden` attribute for non-active panels.

### GradeDisplay.jsx

Renders the grade in the panel header. Shows:
- Calculated percentage in large Fraunces serif type
- Letter grade derived from the course's grading scheme
- Weighted/unweighted indicator
- Discrepancy chip: when Cooked's calculation differs from Canvas's `enrollmentGrade` by more than 0.5%, a yellow chip appears with the delta. This almost always means hidden or unposted assignments.

### TargetInput.jsx

A single text input that accepts:
- Letter grades: `A`, `A-`, `B+`, `B`, `C`, `D`, `F`
- Raw percentages: `87`, `91.5`, `79`

Parsing is done via `letterToPercentWithScheme`, which checks the course's grading scheme first, then falls back to the standard US scale. Valid range is 0–105 (allowing for modest extra credit targets).

The hint paragraph below the input is memoized (`useMemo`) and announces changes via `aria-live="polite"` so screen readers announce the resolved percentage as the user types.

Error state turns the input border red and the hint text red with a descriptive message.

### Breakdown.jsx

Renders all assignment groups as collapsible sections. Each group header is a `<button>` with `aria-expanded`. The `inverseMap` (keyed by assignment ID) is memoized to avoid rebuilding on every render.

Each `AssignmentRow` shows:
- Assignment name and due date
- Class average (if Canvas exposes score statistics)
- For graded assignments: raw score / possible, percentage, color-coded green/neutral/red
- For remaining assignments without a target: upcoming badge (points) or Missing badge
- For remaining assignments with a target: required score chip with color coding:
  - Green pill — needs < 80%
  - Amber pill — needs 80–100%
  - Red pill — needs > 100% (impossible)
  - "on track" chip — already achieved even with a 0
- Dropped assignments: "dropped" chip, row dimmed

### PanicMode.jsx

Panic mode lets the student pick the one assignment that matters (their final, their biggest project) and see exactly what score they need on it, assuming average performance on everything else.

The dropdown is built from `isPanicEligible` assignments — broader than the inverse solver's `isRemaining`, because it includes auto-graded-zero missing assignments.

The result card has `role="status" aria-live="polite"` so screen readers announce when the calculation updates.

### CourseList.jsx

All-courses view. Shows:
- GPA block at the top (estimated 4.0-scale GPA across all graded courses)
- List of all active courses with letter grade, percentage, GPA contribution
- Each course row is a `<button>` (not a `<div onClick>`) for keyboard accessibility

### ShareCard.jsx

Generates a shareable PNG of the student's grade situation. Uses the browser's Canvas 2D API — not React rendering, not html2canvas — just raw `ctx.fillText` and `ctx.fillRect`.

The card content adapts based on grade state:
- Target set + all achieved → "B is locked in — not cooked"
- Target set + specific score needed → "I only need a 74% to get a B — not cooked"
- Target set + impossible → "Might be cooked — Target B isn't achievable anymore"
- No target, grade available → "Sitting at 87.4% — B"
- No grade → "Grade not loaded yet — Open a Canvas course to get started"

CSS variable colors are mapped to actual hex values via a constant object before being written to the canvas context (canvas `fillStyle` doesn't understand CSS variables).

---

## Stylesheet (`base.css`)

Custom CSS only — no Tailwind, no UI framework. All classes are scoped with the `.ck-` prefix to prevent any bleed into Canvas's own styles.

### Design Tokens

```css
--bg:           #0C0A08   /* near-black warm background */
--bg-2:         #151210   /* slightly lighter surface */
--bg-3:         #1C1916   /* card/panel surface */
--border:       #2C2720   /* subtle warm borders */
--text:         #E8E0D8   /* primary text */
--text-2:       #B8AFA8   /* secondary text */
--text-3:       #918980   /* muted/hint text (WCAG AA vs --bg) */
--accent:       #C89A2C   /* amber — primary brand color */
--green:        #4AAB7A   /* success */
--red:          #D14545   /* error/danger */
--yellow:       #C8912C   /* warning */
--border-focus: #C89A2C   /* focus ring color */
```

### Accessibility

All interactive elements have `:focus-visible` outlines using `--border-focus`. This includes: `.ck-tab`, `.ck-courses-btn`, `.ck-back-btn`, `.ck-quick-btn`, `.ck-tab-btn`, `.ck-btn`, `.ck-group-header`, `.ck-course-row`.

`--text-3` (#918980) passes WCAG AA contrast (4.5:1) against `--bg` (#0C0A08).

### Typography

- **Display/headings:** Fraunces (variable serif, loaded from Google Fonts)
- **UI text:** DM Sans (geometric sans, loaded from Google Fonts)
- **Monospace numbers:** DM Mono or system monospace

Google Fonts are loaded via a `<link>` in `sidepanel.html`. The manifest's `content_security_policy` explicitly allows `style-src 'self' https://fonts.googleapis.com` and `font-src https://fonts.gstatic.com` — without this, MV3's default CSP blocks external stylesheets.

---

## Manifest (`manifest.json`)

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "sidePanel", "tabs"],
  "host_permissions": ["https://*.instructure.com/*"],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;"
  },
  "side_panel": { "default_path": "sidepanel.html" },
  "background": { "service_worker": "background.js" }
}
```

**Permissions rationale:**
- `sidePanel` — required to call `chrome.sidePanel.setPanelBehavior`
- `tabs` — required to read the active tab's URL (the side panel has no origin)
- `storage` — reserved for future preferences persistence
- `host_permissions: https://*.instructure.com/*` — required for `credentials: include` cross-origin requests

---

## Known Limitations

- **Unposted/hidden assignments** are not visible via the Canvas API. They are the most common cause of a discrepancy between Cooked's grade and Canvas's displayed grade.
- **Extra credit beyond 100%** is displayed correctly in the grade header but the inverse solver marks any assignment requiring >100% as "impossible" — the solver can't project bonus points not yet earned.
- **Requires Chrome 114+** for the Side Panel API.
- **Courses without grades enabled** (labs, pass/fail) may show incomplete data depending on Canvas's API response.

---

## Development

```bash
npm install
npm run build        # → dist/
```

Load `dist/` as an unpacked extension at `chrome://extensions` with Developer Mode enabled.

The extension only activates on `*.instructure.com` origins. Navigate to any Canvas page on your school's domain before clicking the extension icon.

---

## Repo

GitHub: `https://github.com/Neekoras/cooked`  
Main branch: `main`  
Working branch: `headline`
