/**
 * gradeEngine.js — Pure grade calculation functions.
 *
 * No DOM. No side effects. No imports from browser APIs.
 * Every function is independently testable.
 */

// ---------------------------------------------------------------------------
// GPA scale
// ---------------------------------------------------------------------------

export const GPA_SCALE = [
  { min: 97, points: 4.0 },
  { min: 93, points: 4.0 },
  { min: 90, points: 3.7 },
  { min: 87, points: 3.3 },
  { min: 83, points: 3.0 },
  { min: 80, points: 2.7 },
  { min: 77, points: 2.3 },
  { min: 73, points: 2.0 },
  { min: 70, points: 1.7 },
  { min: 67, points: 1.3 },
  { min: 63, points: 1.0 },
  { min: 60, points: 0.7 },
  { min: 0,  points: 0.0 },
];

export function percentToGPA(pct) {
  if (pct === null || pct === undefined) return null;
  for (const { min, points } of GPA_SCALE) {
    if (pct >= min) return points;
  }
  return 0.0;
}

/** Map a letter grade to GPA points (works for A, A-, B+, etc.) */
const LETTER_GPA_MAP = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'D-': 0.7,
  'F': 0.0,
};

export function letterToGPA(letter) {
  if (!letter) return null;
  const up = String(letter).toUpperCase().trim();
  return LETTER_GPA_MAP[up] ?? LETTER_GPA_MAP[up[0]] ?? null;
}

/**
 * Normalize a Canvas grading scheme array into sorted {letter, minPct} entries.
 * Canvas format: [{ name: 'A', value: 0.8 }, ...] where value is 0–1.
 * Returns null if no valid scheme.
 */
export function normalizeGradingScheme(scheme) {
  if (!Array.isArray(scheme) || scheme.length === 0) return null;
  const sorted = [...scheme].sort((a, b) => b.value - a.value);
  const maxVal = sorted[0].value;
  // Canvas sends values as 0–1 decimals OR 1–100 percentages depending on the instance.
  const alreadyPct = maxVal > 1;
  const normalized = sorted.map(({ name, value }) => ({
    letter: name,
    minPct: alreadyPct ? value : value * 100,
  }));
  // If the top threshold ends up >= 100 (e.g. value was exactly 1.0 → *100 = 100),
  // or no entry has a threshold above 50%, the scheme is malformed — fall back to
  // the standard US scale so we never show F on a 94%.
  if (normalized[0]?.minPct >= 100) return null;
  if (!normalized.some(e => e.minPct > 50)) return null;
  return normalized;
}

/** Convert percent to letter using a course-specific scheme (fallback: standard scale). */
export function percentToLetterWithScheme(pct, normalizedScheme) {
  if (!normalizedScheme) return percentToLetter(pct);
  for (const { letter, minPct } of normalizedScheme) {
    if (pct >= minPct) return letter;
  }
  return normalizedScheme[normalizedScheme.length - 1]?.letter ?? 'F';
}

/**
 * Parse a letter grade or percentage string to a minimum percentage,
 * using a course-specific scheme when available.
 */
export function letterToPercentWithScheme(input, normalizedScheme) {
  if (!normalizedScheme) return letterToPercent(input);
  const normalized = String(input).trim().toUpperCase();
  const entry = normalizedScheme.find(e => e.letter.toUpperCase() === normalized);
  if (entry) return entry.minPct;
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

/**
 * Calculate GPA from a list of courses.
 * Uses Canvas's own letter grade (already scheme-aware) when available,
 * falls back to computing from the raw score.
 */
export function calcGPA(courses) {
  // courses: array of { currentScore, currentGrade }
  const valid = courses.filter(c => c.currentScore !== null || c.currentGrade !== null);
  if (valid.length === 0) return null;
  const sum = valid.reduce((s, c) => {
    const pts = c.currentGrade
      ? (letterToGPA(c.currentGrade) ?? percentToGPA(c.currentScore))
      : percentToGPA(c.currentScore);
    return s + (pts ?? 0);
  }, 0);
  return sum / valid.length;
}

// ---------------------------------------------------------------------------
// Letter grade mapping (standard US scale)
// ---------------------------------------------------------------------------

export const GRADE_SCALE = [
  { letter: 'A+', min: 97 },
  { letter: 'A',  min: 93 },
  { letter: 'A-', min: 90 },
  { letter: 'B+', min: 87 },
  { letter: 'B',  min: 83 },
  { letter: 'B-', min: 80 },
  { letter: 'C+', min: 77 },
  { letter: 'C',  min: 73 },
  { letter: 'C-', min: 70 },
  { letter: 'D+', min: 67 },
  { letter: 'D',  min: 63 },
  { letter: 'D-', min: 60 },
  { letter: 'F',  min: 0  },
];

/** Convert letter grade to its minimum percentage threshold. */
export function letterToPercent(input) {
  if (input === null || input === undefined) return null;
  const normalized = String(input).trim().toUpperCase();
  const entry = GRADE_SCALE.find(g => g.letter === normalized);
  if (entry) return entry.min;
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

/** Convert a percentage to the corresponding letter grade. */
export function percentToLetter(pct) {
  if (pct === null || pct === undefined) return '—';
  for (const { letter, min } of GRADE_SCALE) {
    if (pct >= min) return letter;
  }
  return 'F';
}

// ---------------------------------------------------------------------------
// Assignment classification
// ---------------------------------------------------------------------------

/**
 * An assignment is "graded" when it has a real numeric score.
 * Excused assignments are excluded from all calculations (neither graded nor ungraded).
 * Extra credit: score is allowed to exceed points_possible.
 */
export function isGraded(assignment) {
  const sub = assignment.submission;
  if (!sub) return false;
  if (sub.excused) return false;
  return (
    sub.workflow_state === 'graded' &&
    sub.score !== null &&
    sub.score !== undefined
  );
}

export function isExcused(assignment) {
  return Boolean(assignment?.submission?.excused);
}

/**
 * An assignment counts as "remaining" if it has no score yet and is not excused.
 * Only assignments with points_possible > 0 are actionable.
 */
export function isRemaining(assignment) {
  if (isExcused(assignment)) return false;
  if (isGraded(assignment)) return false;
  return (assignment.points_possible ?? 0) > 0;
}

/**
 * Wider filter used for the Panic Mode dropdown.
 * Includes "missing" assignments auto-graded as 0 by teachers — they show as
 * graded in Canvas's API but the student hasn't actually done the work yet.
 * These are identifiable by: workflow_state === 'graded' && score === 0 &&
 * (late_policy_status === 'missing' OR missing === true).
 */
export function isPanicEligible(assignment) {
  if (isExcused(assignment)) return false;
  if ((assignment.points_possible ?? 0) === 0) return false;
  if (isRemaining(assignment)) return true;
  // Also include auto-graded missing assignments (score=0, flagged as missing)
  const sub = assignment.submission;
  if (!sub) return false;
  const isMissing = sub.missing === true || sub.late_policy_status === 'missing';
  const isZeroGraded = sub.workflow_state === 'graded' && sub.score === 0;
  return isMissing && isZeroGraded;
}

// ---------------------------------------------------------------------------
// Drop rules
// ---------------------------------------------------------------------------

/**
 * Given a list of GRADED assignments and a rules object, return the subset
 * that survives after applying drop_lowest and drop_highest.
 *
 * Rules shape: { drop_lowest: number, drop_highest: number, never_drop: number[] }
 * Assignments in never_drop are immune to being dropped.
 * Extra-credit assignments (points_possible === 0) are never dropped.
 */
export function applyDropRules(gradedAssignments, rules) {
  if (!rules || gradedAssignments.length === 0) return gradedAssignments;

  const neverDrop = new Set((rules.never_drop || []).map(String));

  // Score percentage used for ranking. Extra credit (poss=0) ranks highest.
  const pct = a =>
    a.points_possible > 0
      ? a.submission.score / a.points_possible
      : Infinity;

  // Ascending sort for drop-lowest
  const sorted = [...gradedAssignments].sort((a, b) => pct(a) - pct(b));
  const dropped = new Set();

  if ((rules.drop_lowest ?? 0) > 0) {
    let n = 0;
    for (const a of sorted) {
      if (n >= rules.drop_lowest) break;
      if (!neverDrop.has(String(a.id))) {
        dropped.add(a.id);
        n++;
      }
    }
  }

  if ((rules.drop_highest ?? 0) > 0) {
    let n = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (n >= rules.drop_highest) break;
      const a = sorted[i];
      if (!dropped.has(a.id) && !neverDrop.has(String(a.id))) {
        dropped.add(a.id);
        n++;
      }
    }
  }

  return gradedAssignments.filter(a => !dropped.has(a.id));
}

// ---------------------------------------------------------------------------
// Per-group score
// ---------------------------------------------------------------------------

/**
 * Calculate the score for a single assignment group.
 *
 * Returns:
 *   earned       — total raw points earned (after drops, no cap for extra credit)
 *   possible     — total points possible (after drops)
 *   percent      — earned/possible * 100, or null if no graded assignments
 *   droppedIds   — Set of assignment IDs that were dropped
 *   gradedCount  — number of assignments counted (after drops)
 */
export function calcGroupScore(group) {
  const assignments = group.assignments || [];
  const graded = assignments.filter(a => isGraded(a));
  const afterDrops = applyDropRules(graded, group.rules);

  const droppedIds = new Set(
    graded
      .filter(a => !afterDrops.some(b => b.id === a.id))
      .map(a => a.id)
  );

  let earned = 0;
  let possible = 0;

  for (const a of afterDrops) {
    earned += a.submission.score; // no cap — extra credit is valid
    possible += a.points_possible;
  }

  return {
    earned,
    possible,
    percent: possible > 0 ? (earned / possible) * 100 : null,
    droppedIds,
    gradedCount: afterDrops.length,
  };
}

/**
 * Get remaining (ungraded, non-excused, actionable) assignments for a group.
 */
export function getRemaining(group) {
  return (group.assignments || []).filter(isRemaining);
}

// ---------------------------------------------------------------------------
// Full grade calculation
// ---------------------------------------------------------------------------

/**
 * Compute the student's current grade and annotate each group with score data.
 *
 * Returns:
 *   grade         — overall percentage (null if no data)
 *   groupResults  — enriched group array with .score and .remaining attached
 *   isWeighted    — whether weighted grading was applied
 *   totalRemaining — count of ungraded assignments across all groups
 */
export function calculateGrade(groups, isWeighted) {
  const groupResults = groups.map(group => ({
    ...group,
    score: calcGroupScore(group),
    remaining: getRemaining(group),
  }));

  let grade = null;

  if (isWeighted) {
    // Canvas normalises weights: divide by sum of weights of groups that have data,
    // not by 100. This matches Canvas's own behaviour.
    let weightedSum = 0;
    let totalWeight = 0;

    for (const g of groupResults) {
      if (g.score.percent === null) continue; // group has no graded work yet
      const w = g.group_weight ?? 0;
      weightedSum += (g.score.percent / 100) * w;
      totalWeight += w;
    }

    grade = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : null;
  } else {
    let totalEarned = 0;
    let totalPossible = 0;

    for (const g of groupResults) {
      totalEarned += g.score.earned;
      totalPossible += g.score.possible;
    }

    grade = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;
  }

  const totalRemaining = groupResults.reduce((s, g) => s + g.remaining.length, 0);

  return { grade, groupResults, isWeighted, totalRemaining };
}

// ---------------------------------------------------------------------------
// Shared weighted-grade helpers
// ---------------------------------------------------------------------------

/**
 * Compute effective total weight and other-group contribution for a given
 * anchor group.  Matches Canvas's normalization: only groups with graded data
 * (plus the anchor group, which will have data once work is submitted) count.
 */
function computeGroupWeighting(groupResults, anchorGroupId) {
  const effectiveTotalWeight =
    groupResults
      .filter(g => g.score.percent !== null || g.id === anchorGroupId)
      .reduce((s, g) => s + (g.group_weight ?? 0), 0) || 100;

  const otherContrib = groupResults
    .filter(g => g.id !== anchorGroupId)
    .reduce((sum, g) => {
      if (g.score.percent === null) return sum;
      return sum + (g.score.percent / 100) * ((g.group_weight ?? 0) / effectiveTotalWeight);
    }, 0);

  return { effectiveTotalWeight, otherContrib };
}

// ---------------------------------------------------------------------------
// Inverse calculation — "what do I need to hit my target?"
// ---------------------------------------------------------------------------

/**
 * Given a target overall percentage, compute the required score on each
 * remaining assignment.
 *
 * When multiple assignments are ungraded within a group, required effort is
 * distributed proportionally to each assignment's points_possible.
 *
 * Returns an array sorted by due_at (nulls last), each item:
 *   assignmentId     — Canvas assignment ID
 *   assignmentName   — display name
 *   groupName        — parent group name
 *   pointsPossible   — assignment max points
 *   requiredScore    — raw points needed (may exceed pointsPossible if impossible)
 *   requiredPercent  — requiredScore / pointsPossible * 100
 *   isImpossible     — requiredScore > pointsPossible (can't achieve even with 100%)
 *   isAchieved       — requiredScore <= 0 (already on track even without this)
 *   dueAt            — ISO date string or null
 */
export function solveInverse(groupResults, targetPercent, isWeighted) {
  const target = targetPercent / 100;
  const results = [];

  if (isWeighted) {
    for (const group of groupResults) {
      if (group.remaining.length === 0) continue;

      const { effectiveTotalWeight, otherContrib } = computeGroupWeighting(groupResults, group.id);
      const groupNormWeight = (group.group_weight ?? 0) / effectiveTotalWeight;

      const requiredGroupContrib = target - otherContrib;
      const requiredGroupPct =
        groupNormWeight > 0 ? requiredGroupContrib / groupNormWeight : null;

      if (requiredGroupPct === null) continue;

      // Within this group:
      //   (earned_so_far + needed_on_remaining) / (possible_so_far + remaining_possible)
      //   = requiredGroupPct
      const remainingPossible = group.remaining.reduce(
        (s, a) => s + a.points_possible, 0
      );
      if (remainingPossible === 0) continue; // all remaining are pure extra credit

      const totalGroupPossible = group.score.possible + remainingPossible;
      const requiredTotalEarned = requiredGroupPct * totalGroupPossible;
      const neededOnRemaining = requiredTotalEarned - group.score.earned;

      for (const a of group.remaining) {
        const proportion = a.points_possible / remainingPossible;
        const needed = neededOnRemaining * proportion;
        pushResult(results, a, group.name, needed);
      }
    }
  } else {
    // Unweighted: pure point total
    const totalEarned = groupResults.reduce((s, g) => s + g.score.earned, 0);
    const totalPossible = groupResults.reduce((s, g) => s + g.score.possible, 0);
    const totalRemainingPossible = groupResults.reduce(
      (s, g) => s + g.remaining.reduce((ss, a) => ss + a.points_possible, 0), 0
    );

    const grandTotal = totalPossible + totalRemainingPossible;
    const neededOnAll = target * grandTotal - totalEarned;
    // neededPct is the uniform percentage needed across all remaining work
    const neededPct =
      totalRemainingPossible > 0 ? neededOnAll / totalRemainingPossible : null;

    for (const group of groupResults) {
      for (const a of group.remaining) {
        const needed = neededPct !== null ? neededPct * a.points_possible : null;
        pushResult(results, a, group.name, needed);
      }
    }
  }

  return results.sort(byDueDate);
}

/**
 * Panic mode: solve for a single specific assignment.
 *
 * Assumes all OTHER remaining assignments score at the current group average
 * (or 75% if no graded work exists yet). Returns a single result object or
 * null if the assignment isn't found in remaining work.
 */
export function solvePanic(groupResults, targetPercent, assignmentId, isWeighted) {
  const target = targetPercent / 100;
  const id = String(assignmentId);

  let panicAssignment = null;
  let panicGroup = null;
  let panicIsAutoZero = false; // auto-graded-zero missing assignments need score adjustment

  for (const g of groupResults) {
    // Search remaining first (most common case)
    const inRemaining = g.remaining.find(a => String(a.id) === id);
    if (inRemaining) { panicAssignment = inRemaining; panicGroup = g; break; }

    // Also search all assignments for auto-graded-zero missing ones (score=0,
    // flagged missing) — they pass isPanicEligible but not isRemaining.
    const inAll = (g.assignments || []).find(
      a => String(a.id) === id && isPanicEligible(a) && !isRemaining(a)
    );
    if (inAll) { panicAssignment = inAll; panicGroup = g; panicIsAutoZero = true; break; }
  }

  if (!panicAssignment || !panicGroup) return null;

  if (isWeighted) {
    const { effectiveTotalWeight, otherContrib } = computeGroupWeighting(groupResults, panicGroup.id);
    const groupNormWeight = (panicGroup.group_weight ?? 0) / effectiveTotalWeight;

    const requiredGroupPct =
      groupNormWeight > 0 ? (target - otherContrib) / groupNormWeight : null;
    if (requiredGroupPct === null) return null;

    // For auto-graded-zero assignments: their 0 score is already in the group
    // earned/possible totals — back it out so the solver treats it as unscored.
    const baseEarned   = panicGroup.score.earned   - (panicIsAutoZero ? 0 : 0);
    const basePossible = panicGroup.score.possible  - (panicIsAutoZero ? panicAssignment.points_possible : 0);

    // Other remaining assignments in this group: assume current group average.
    // Only fall back to 75% when there is genuinely no graded data.
    const fallbackPct = basePossible > 0 ? baseEarned / basePossible : 0.75;

    const otherRemaining = panicGroup.remaining.filter(a => String(a.id) !== id);
    const otherEarned = otherRemaining.reduce(
      (s, a) => s + fallbackPct * a.points_possible, 0
    );
    const otherPossible = otherRemaining.reduce((s, a) => s + a.points_possible, 0);

    const totalGroupPossible = basePossible + otherPossible + panicAssignment.points_possible;
    const currentGroupEarned = baseEarned + otherEarned;
    const neededOnPanic = requiredGroupPct * totalGroupPossible - currentGroupEarned;

    return buildResult(panicAssignment, panicGroup.name, neededOnPanic);
  } else {
    // Unweighted: back out auto-graded-zero score from totals if needed
    const totalEarned   = groupResults.reduce((s, g) => s + g.score.earned, 0);
    const totalPossible = groupResults.reduce((s, g) => s + g.score.possible, 0)
      - (panicIsAutoZero ? panicAssignment.points_possible : 0);
    const fallbackPct =
      totalPossible > 0 ? totalEarned / totalPossible : 0.75;

    const allOtherRemaining = groupResults
      .flatMap(g => g.remaining)
      .filter(a => String(a.id) !== id);

    const otherEarned = allOtherRemaining.reduce(
      (s, a) => s + fallbackPct * a.points_possible, 0
    );
    const otherPossible = allOtherRemaining.reduce((s, a) => s + a.points_possible, 0);

    const grandTotal = totalPossible + otherPossible + panicAssignment.points_possible;
    const projectedEarned = totalEarned + otherEarned;
    const neededOnPanic = target * grandTotal - projectedEarned;

    return buildResult(panicAssignment, panicGroup.name, neededOnPanic);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildResult(assignment, groupName, needed) {
  const pct = assignment.points_possible > 0
    ? (needed / assignment.points_possible) * 100
    : null;
  return {
    assignmentId: assignment.id,
    assignmentName: assignment.name,
    groupName,
    pointsPossible: assignment.points_possible,
    requiredScore: needed,
    requiredPercent: pct,
    isImpossible: needed > assignment.points_possible * 1.001,
    isAchieved: needed <= 0,
    dueAt: assignment.due_at ?? null,
  };
}

function pushResult(results, assignment, groupName, needed) {
  if (needed === null) return;
  results.push(buildResult(assignment, groupName, needed));
}

function byDueDate(a, b) {
  if (!a.dueAt && !b.dueAt) return 0;
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  return new Date(a.dueAt) - new Date(b.dueAt);
}
