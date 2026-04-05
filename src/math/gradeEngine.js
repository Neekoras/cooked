/**
 * gradeEngine.js — Pure grade calculation functions.
 *
 * No DOM. No side effects. No imports from browser APIs.
 * Every function is independently testable.
 */

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
    const totalWeight =
      groupResults.reduce((s, g) => s + (g.group_weight ?? 0), 0) || 100;

    for (const group of groupResults) {
      if (group.remaining.length === 0) continue;

      const groupNormWeight = (group.group_weight ?? 0) / totalWeight;

      // Contribution from every OTHER group using their current score.
      // Groups with no graded work contribute 0 (can't assume a score).
      const otherContrib = groupResults
        .filter(g => g.id !== group.id)
        .reduce((sum, g) => {
          if (g.score.percent === null) return sum;
          return sum + (g.score.percent / 100) * ((g.group_weight ?? 0) / totalWeight);
        }, 0);

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

  for (const g of groupResults) {
    const found = g.remaining.find(a => String(a.id) === id);
    if (found) { panicAssignment = found; panicGroup = g; break; }
  }

  if (!panicAssignment || !panicGroup) return null;

  if (isWeighted) {
    const totalWeight =
      groupResults.reduce((s, g) => s + (g.group_weight ?? 0), 0) || 100;
    const groupNormWeight = (panicGroup.group_weight ?? 0) / totalWeight;

    const otherContrib = groupResults
      .filter(g => g.id !== panicGroup.id)
      .reduce((sum, g) => {
        if (g.score.percent === null) return sum;
        return sum + (g.score.percent / 100) * ((g.group_weight ?? 0) / totalWeight);
      }, 0);

    const requiredGroupPct =
      groupNormWeight > 0 ? (target - otherContrib) / groupNormWeight : null;
    if (requiredGroupPct === null) return null;

    // Other remaining assignments in this group: assume current group average
    const fallbackPct = panicGroup.score.percent !== null
      ? panicGroup.score.percent / 100
      : 0.75;

    const otherRemaining = panicGroup.remaining.filter(a => String(a.id) !== id);
    const otherEarned = otherRemaining.reduce(
      (s, a) => s + fallbackPct * a.points_possible, 0
    );
    const otherPossible = otherRemaining.reduce((s, a) => s + a.points_possible, 0);

    const totalGroupPossible =
      panicGroup.score.possible + otherPossible + panicAssignment.points_possible;
    const currentGroupEarned = panicGroup.score.earned + otherEarned;
    const neededOnPanic =
      requiredGroupPct * totalGroupPossible - currentGroupEarned;

    return buildResult(panicAssignment, panicGroup.name, neededOnPanic);
  } else {
    const totalEarned = groupResults.reduce((s, g) => s + g.score.earned, 0);
    const totalPossible = groupResults.reduce((s, g) => s + g.score.possible, 0);
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
