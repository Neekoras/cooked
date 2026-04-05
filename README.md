# Cooked?

> *The grade calculator Canvas should have shipped years ago.*

**Cooked** is a Chrome extension that plugs directly into Canvas LMS and solves the one question every student asks at the end of the semester — *"What do I need on my final to get a B?"* — in real time, with no login, no setup, and no math.

Canvas has a built-in "What-If Grades" tool. It lets you simulate a future score forward. What it has never done — despite being the single most requested feature on the Canvas Community forums for over six years — is solve the problem **in reverse**: given a target grade, what score do you actually need? That's the question that matters. Cooked answers it.

---

## What it does

Open Cooked on any Canvas grades page and you get an instant sidebar with:

- **Your real current grade** — recalculated from raw assignment data, weighted exactly the way Canvas weights it, with drop rules applied
- **Discrepancy detection** — flags when our calculated grade differs from Canvas's displayed grade so you know if something's been graded but not synced
- **Inverse grade solver** — set a target (type `A-`, `B+`, or `87`) and every remaining assignment shows the exact score you need to hit it
- **Panic Mode** — pick the one assignment that matters (your final, your project, your last exam) and see the exact score you need, assuming you average out on everything else
- **Breakdown view** — every assignment group, weighted, with drop rules shown, collapsed and expandable
- **Share Card** — generates a clean image of your grade summary you can screenshot and send

---

## Why it's different

| Feature | Canvas What-If | Cooked |
|---|---|---|
| Forward simulation (what if I get X?) | ✅ | ✅ |
| **Inverse calculation (what do I need to get X?)** | ❌ | ✅ |
| Works without touching anything | ❌ requires manual input | ✅ automatic |
| Drop rules (drop lowest N) | ✅ | ✅ |
| Weighted groups | ✅ | ✅ |
| Extra credit support | ❌ | ✅ |
| Single-assignment panic solver | ❌ | ✅ |
| Works on mobile | ❌ | ❌ (Chrome extension) |

---

## Installation

Cooked is not on the Chrome Web Store (yet). Load it manually:

1. Clone or download this repo
2. Run `npm install` then `npm run build`
3. Open Chrome → `chrome://extensions`
4. Enable **Developer mode** (top right toggle)
5. Click **Load unpacked** → select the `dist/` folder
6. Navigate to any Canvas grades page (`/courses/*/grades`)
7. Look for the **COOKED** tab on the right edge of the screen

> Tested on `sequoia.instructure.com`. Works on any `*.instructure.com` domain.

---

## Usage

### Checking your grade
Just open Cooked. It reads your Canvas session automatically — no API keys, no OAuth, no permissions beyond what your browser already has. Your grade appears in the header.

### Setting a target
Type a letter grade or percentage into the **Target grade** field. Accepted formats:
- Letter grades: `A`, `A-`, `B+`, `B`, `C+`, etc.
- Percentages: `87`, `91.5`, `79`

Every remaining assignment in the Breakdown tab immediately updates to show what score you need.

### Panic Mode
Go to the **Panic** tab. Select the assignment you're focused on — your final exam, your last project, whatever it is — and Cooked tells you the exact score needed on that one assignment to hit your target, assuming you average your current pace on everything else.

### Share Card
Hit the **Share** tab to generate a clean summary card. Screenshot it. Send it to your parents. Use it as evidence in a grade dispute. Whatever you need.

---

## How the math works

### Current grade (weighted)

Canvas normalizes group weights by the sum of weights of groups that actually have graded data — not by 100. This is why your grade can look "off" early in the semester when some groups are empty. Cooked replicates this exactly:

```
grade = Σ (group_percent × group_weight) / Σ (group_weight for groups with data)
```

### Drop rules

Assignment groups can have `drop_lowest` and `drop_highest` rules. Cooked applies them in the same order Canvas does — lowest scores dropped first, assignments in `never_drop` are immune, extra credit (points_possible = 0) is never dropped.

### Inverse calculation

Given a target overall percentage `T` and a remaining assignment `a` in group `g`:

```
required_group_percent = (T - contribution_from_other_groups) / normalized_group_weight

needed_on_a = required_group_percent × (group_earned_so_far + remaining_in_group_possible)
              - group_earned_so_far
              × (a.points_possible / total_remaining_in_group)
```

When multiple assignments are ungraded within a group, the required effort is distributed proportionally to each assignment's point value.

### Panic solver

Panic mode isolates a single assignment. All other remaining work in the course is assumed to score at the student's current overall average (or 75% if no grades exist yet). The required score on the panic assignment is then solved for directly.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Extension API | Manifest V3 | Required for Chrome |
| UI | React 18 + JSX | Component-driven sidebar |
| Styles | Custom CSS (no framework) | Scoped `.ck-*` classes, zero bleed into Canvas |
| Bundler | Webpack 5 + Babel | Tree-shaking, CSS inlining |
| CSS delivery | `to-string-loader` | Injects styles into `document.head` at runtime |
| Canvas API | REST v1 (`credentials: include`) | Uses existing browser session, no OAuth |
| Math | Pure JS, zero deps | No DOM, independently testable |
| Fonts | Google Fonts (Playfair Display, DM Sans) | Injected via `<link>` to avoid CSP blocks |

No Tailwind. No UI library. No external tracking. No data leaves your browser.

---

## Building from source

```bash
npm install
npm run build        # production build → dist/
```

The `dist/` folder is what you load into Chrome. It is not committed to this repo — build it locally.

---

## Project structure

```
cooked/
├── manifest.json           # MV3 manifest (copied to dist by webpack)
├── webpack.config.js
├── src/
│   ├── content.js          # Entry point — mounts React into Canvas page
│   ├── background.js       # Service worker (minimal)
│   ├── api/
│   │   └── canvasClient.js # Canvas REST API fetching + pagination
│   ├── math/
│   │   └── gradeEngine.js  # Pure grade math — no DOM, fully testable
│   ├── styles/
│   │   └── base.css        # All UI styles, scoped to .ck-root
│   ├── icons/              # Extension icons (16/48/128px)
│   └── ui/
│       ├── Sidebar.jsx     # Main panel — state, data loading, tabs
│       ├── GradeDisplay.jsx
│       ├── TargetInput.jsx
│       ├── Breakdown.jsx   # Assignment group list with inverse results
│       ├── PanicMode.jsx   # Single-assignment solver
│       └── ShareCard.jsx   # Canvas 2D image generator
```

---

## Known limitations

- **Extra credit beyond 100%** is supported in the grade calculation but the inverse solver will mark it as "impossible" if it exceeds `points_possible`. This is intentional — the solver can't guarantee you'll get extra credit.
- **Grade schemes** (custom letter grade cutoffs per course) are not yet fetched from the API. The extension uses the standard US scale.
- **Unposted/hidden assignments** are not visible via the API and are therefore not counted.
- **Group weights summing to more or less than 100%** are handled by Canvas's normalization, which Cooked replicates.

---

## License

MIT — use it, fork it, build on it.

---

*Built for students by a student. If this saved your GPA, consider starring the repo.*
