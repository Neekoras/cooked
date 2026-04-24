# Cooked?

> *The grade calculator Canvas should have shipped years ago.*

**Cooked** is a Chrome extension that plugs directly into Canvas LMS and answers the question every student has at the end of the semester — *"What do I need on my final to get a B?"* — in real time, with no login, no setup, and no math on your end.

Canvas has a built-in "What-If Grades" tool. It lets you simulate a future score forward. What it has never done — despite being the single most requested feature on the Canvas Community forums for over six years — is solve the problem **in reverse**: given a target grade, what score do you actually need? That's the question that matters. Cooked answers it.

---

## What it does

Click the Cooked icon in your Chrome toolbar and a native side panel slides open alongside your browser tab. It reads your Canvas session automatically and gives you:

- **Your real current grade** — recalculated from raw assignment data, weighted exactly the way Canvas weights it, with drop rules applied
- **Discrepancy detection** — flags when our calculated grade differs from Canvas's displayed grade, which usually means hidden or unposted assignments
- **Inverse grade solver** — set a target (type `A-`, `B+`, or `87`) and every remaining assignment immediately shows the exact score you need to hit it
- **Panic Mode** — pick the one assignment that matters (your final, your last project, your biggest exam) and see the exact score you need on that one, assuming average performance on everything else
- **Course switcher** — view grades and jump between all your active Canvas courses without leaving the panel
- **GPA overview** — 4.0 scale GPA calculated across all your courses using Canvas's own letter grades
- **Breakdown view** — every assignment group collapsed and expandable, with weights, drop rules, class averages, and missing/upcoming status shown per assignment
- **Share Card** — generates a clean PNG image of your grade summary you can screenshot and send wherever

---

## Why it's different

| Feature | Canvas What-If | Cooked |
|---|---|---|
| Forward simulation (what if I get X?) | ✅ | ✅ |
| **Inverse calculation (what do I need to get X?)** | ❌ | ✅ |
| Works without touching anything | ❌ requires manual input | ✅ automatic |
| Drop rules (drop lowest N) | ✅ | ✅ |
| Weighted groups | ✅ | ✅ |
| Custom grading schemes (per-course letter cutoffs) | ✅ | ✅ |
| Extra credit support | ❌ | ✅ |
| Single-assignment panic solver | ❌ | ✅ |
| Multi-course overview + GPA | ❌ | ✅ |
| Native browser side panel | ❌ | ✅ |
| Works on mobile | ❌ | ❌ (Chrome extension) |

---

## Installation

Cooked is not on the Chrome Web Store yet. Load it manually:

1. Clone or download this repo
2. Run `npm install` then `npm run build`
3. Open Chrome → `chrome://extensions`
4. Enable **Developer mode** (toggle, top right)
5. Click **Load unpacked** → select the `dist/` folder
6. Pin the Cooked icon to your toolbar
7. Navigate to any Canvas page on your school's domain
8. Click the Cooked icon — a side panel opens to the right

> Requires Chrome 114 or later (Side Panel API). Tested on `*.instructure.com` domains.

---

## Usage

### Checking your grade

Just click the icon. Cooked reads your Canvas session automatically — no API keys, no OAuth, no account creation. It detects your school's Canvas domain from the active tab URL and your current course from the page you're on. Your grade appears instantly in the panel header.

### Switching courses

Use the **quick switcher** — a row of pill buttons near the top of the panel — to jump between your active courses. Each pill shows an abbreviation of the course name. Clicking one loads that course's grades and navigates your browser tab to that course's grades page at the same time.

For a full list of all courses with grades and letter grades, click **All Courses** in the panel header. This view also shows your overall GPA.

### Setting a target

Type a letter grade or percentage into the **Target grade** field. Accepted formats:
- Letter grades: `A`, `A-`, `B+`, `B`, `C+`, `C`, `D`, `F`
- Percentages: `87`, `91.5`, `79`

The field resolves your input in real time — if you type `B+` it shows `87% — B+` below the input so you know exactly what you're solving for. Every remaining assignment in the Breakdown tab immediately updates to show the exact score you need.

### Reading the Breakdown

Each assignment group is collapsible. Inside each group you'll see every assignment with:

- **Name and due date** — with class average shown if Canvas has score statistics
- **Your score** — color-coded green/neutral/red based on how you performed, slightly dimmed for completed assignments
- **Required score chip** — only appears when you've set a target. Shows the score you'd need and is color-coded:
  - 🟢 Green pill — you need less than 80%, comfortable range
  - 🟡 Amber pill — you need 80–100%, high bar but achievable
  - 🔴 Red pill — you'd need over 100%, not achievable
  - ✅ "on track" — you'd hit your target even with a 0 on this one
- **State badges** — assignments with no submission show a "X pts" upcoming badge; assignments Canvas has flagged as missing show a red **Missing** badge

Each row also has a subtle left border color:
- Faint green = graded (done)
- Faint red = missing

### Panic Mode

Go to the **Panic** tab. Select the assignment you're focused on from the dropdown — your final, your last project, whatever it is. Cooked tells you the exact score needed on that one assignment to hit your target, assuming you perform at your current average on everything else. If it's already locked in (you'd hit your target even with a 0), it says so. If it's mathematically impossible, it tells you that too and suggests adjusting your target.

### Share Card

The **Share** tab generates a shareable summary card. The card adapts its message to your situation — "already locked in", "I only need a 74%", or "might be cooked" depending on your grade and target. Hit **Download PNG** and you get a 600×280 image ready to send anywhere.

---

## How the math works

### Current grade

**Unweighted courses** — simple total points:
```
grade = total_earned / total_possible × 100
```

**Weighted courses** — Canvas normalizes by the sum of weights that have actual graded data, not always 100. This is why your grade looks off early in a semester when some groups are still empty:
```
grade = Σ(group_percent × group_weight) / Σ(group_weight for groups with graded data)
```

Cooked replicates this exactly, including Canvas's own normalization behavior.

### Drop rules

Assignment groups can have `drop_lowest` and `drop_highest` rules. Cooked applies them in the same order Canvas does: lowest scores first, assignments in the `never_drop` list are immune, and extra credit assignments (0 possible points) are never dropped. Dropped assignments are shown with a muted "dropped" badge and don't count toward your grade or the inverse calculation.

### Inverse calculation

Given a target overall percentage `T` and a remaining assignment `a` in group `g`:

```
required_group_percent = (T × Σ_weights - Σ_other_group_contributions) / group_weight

needed_score_on_a = (required_group_percent × group_total_possible - group_earned_without_a)
                    × (a.points_possible / remaining_possible_in_group)
```

When multiple assignments in a group are still ungraded, the required work is distributed proportionally by each assignment's point value — heavier assignments carry more of the burden.

### Panic solver

Panic mode isolates one assignment. Every other ungraded assignment in the course is assumed to score at the student's current group average (or 75% as a fallback when no grades exist yet). With those scores fixed, the required score on the selected assignment is solved algebraically.

Panic mode's dropdown is broader than the breakdown's remaining list — it includes assignments Canvas auto-graded as zero for missing submissions, since those are still technically "gradeable" by a teacher override.

### Grading schemes

Canvas lets each course define custom letter grade cutoffs. Cooked fetches the grading scheme for each course and applies it — so a 90% is an A in a standard course and might be a different letter at your school. Canvas returns scheme values in two formats (0–1 and 0–100 depending on the school), and Cooked normalizes both transparently.

### GPA calculation

Each course contributes to GPA using its Canvas letter grade (what Canvas officially shows, not our recalculated percentage). Letter grades map to the standard 4.0 scale:

```
A/A+  → 4.0    A-   → 3.7
B+    → 3.3    B    → 3.0    B-   → 2.7
C+    → 2.3    C    → 2.0    C-   → 1.7
D+    → 1.3    D    → 1.0    D-   → 0.7
F     → 0.0
```

GPA is a simple unweighted average across all courses that have a letter grade.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Extension API | Manifest V3 + Side Panel API | Native Chrome side panel, no DOM injection |
| UI | React 18 + JSX | Component-driven, hooks-based state |
| Styles | Custom CSS (no framework) | Scoped `.ck-*` classes, zero bleed into Canvas |
| Bundler | Webpack 5 + Babel | Tree-shaking, CSS inlining via `to-string-loader` |
| Canvas API | REST v1 (`credentials: include`) | Uses existing browser session, no OAuth required |
| Math | Pure JS, zero dependencies | No DOM, independently testable |
| Fonts | Fraunces (display) + DM Sans (UI) | Loaded via Google Fonts link in side panel HTML |

No Tailwind. No UI library. No analytics. No data ever leaves your browser — every calculation happens locally against the Canvas API your browser session already has access to.

---

## Building from source

```bash
npm install
npm run build        # production build → dist/
```

Load the `dist/` folder as an unpacked extension in Chrome. The `dist/` directory is not committed to this repo — build it yourself.

---

## Project structure

```
cooked/
├── manifest.json              # MV3 manifest — permissions, side panel, icons
├── webpack.config.js          # Builds background.js + sidepanel.js → dist/
├── src/
│   ├── background.js          # Service worker — enables side panel on icon click
│   ├── content.js             # Legacy overlay entry point (unused in current build)
│   ├── sidepanel.html         # Side panel shell HTML — loads fonts, mounts React
│   ├── sidepanel.js           # React entry point — injects CSS, renders App
│   ├── api/
│   │   └── canvasClient.js    # Canvas REST API — pagination, session auth, base URL
│   ├── math/
│   │   └── gradeEngine.js     # All grade math — pure JS, no DOM dependencies
│   ├── styles/
│   │   └── base.css           # All UI styles, design tokens, scoped to .ck-root
│   ├── icons/                 # Extension icons (16/48/128px)
│   └── ui/
│       ├── Sidebar.jsx        # Main shell — state, data loading, routing, tab nav
│       ├── GradeDisplay.jsx   # Current grade header with discrepancy detection
│       ├── TargetInput.jsx    # Target grade input — parses letters and percentages
│       ├── Breakdown.jsx      # Assignment group list with inverse score chips
│       ├── PanicMode.jsx      # Single-assignment panic solver
│       ├── CourseList.jsx     # All-courses view with grades and GPA
│       └── ShareCard.jsx      # PNG card generator using Canvas 2D API
```

### How the side panel works

The side panel is a standalone Chrome-managed HTML page (`sidepanel.html`) — it's not injected into Canvas. This means:

- It can't use relative URLs to hit the Canvas API (there's no Canvas origin). `canvasClient.js` stores the school's origin (`setApiBase`) set from reading the active tab URL via `chrome.tabs`.
- All data fetching is gated behind an `apiReady` flag that only flips once the tab URL has been read and the API base is set.
- When you switch courses using the quick switcher, the extension updates the browser tab URL via `chrome.tabs.update()` so the page and the panel stay in sync.
- Course data is cached in a `useRef` map — switching between courses you've already loaded is instant.

---

## Known limitations

- **Unposted/hidden assignments** are not visible via the Canvas API and are therefore not counted in any calculation. This is the most common cause of a discrepancy between Cooked's grade and Canvas's displayed grade.
- **Extra credit beyond 100%** is supported in the grade display but the inverse solver marks assignments as "impossible" if they'd require more than 100% of possible points. This is intentional — the solver can't count on bonus points you haven't earned yet.
- **Group weights summing to more or less than 100%** are handled by Canvas's own normalization, which Cooked replicates, so the grade will still be correct.
- **Courses without grades enabled** (some labs, pass/fail courses) may show no data or incomplete data depending on what Canvas exposes via the API.

---

## License

MIT — use it, fork it, build on it.

---

*Built for students by a student. If this saved your GPA, star the repo.*
