import { useState, useMemo } from 'react';
import { solvePanic, percentToLetter, isPanicEligible, calculateGrade } from '../math/gradeEngine';

/**
 * Compute the projected overall grade if the student scores `scorePct`% on
 * the selected assignment and their group average on all other remaining work.
 * Returns the overall percentage or null.
 */
function projectGrade(groupResults, assignmentId, scorePct, isWeighted) {
  // Deep-clone the group results so we can mutate scores
  const clone = groupResults.map(g => ({
    ...g,
    score: { ...g.score },
    remaining: [...g.remaining],
    assignments: (g.assignments || []).map(a => ({
      ...a,
      submission: a.submission ? { ...a.submission } : null,
    })),
  }));

  // Find and score the target assignment
  for (const g of clone) {
    const a = g.assignments.find(a => String(a.id) === String(assignmentId));
    if (!a) continue;
    // Mark it as graded with the hypothetical score
    const pts = a.points_possible;
    a.submission = {
      ...a.submission,
      workflow_state: 'graded',
      score: (scorePct / 100) * pts,
      missing: false,
      late_policy_status: null,
    };
    break;
  }

  // Also score all other remaining assignments at group average
  for (const g of clone) {
    const graded = g.assignments.filter(a => {
      const sub = a.submission;
      return sub && sub.workflow_state === 'graded' && sub.score !== null && !sub.excused;
    });
    let avg = 0.75;
    if (graded.length > 0) {
      let e = 0, p = 0;
      for (const a of graded) {
        if (a.points_possible > 0) { e += a.submission.score; p += a.points_possible; }
      }
      if (p > 0) avg = e / p;
    }
    for (const a of g.assignments) {
      if (!a.submission || a.submission.workflow_state !== 'graded') {
        a.submission = {
          ...a.submission,
          workflow_state: 'graded',
          score: avg * a.points_possible,
          missing: false,
          late_policy_status: null,
        };
      }
    }
  }

  // Recalculate with all assignments "graded"
  const result = calculateGrade(clone.map(g => ({
    ...g,
    assignments: g.assignments,
  })), isWeighted);

  return result.grade;
}

export default function PanicMode({ groupResults, targetPercent, isWeighted }) {
  const [selectedId, setSelectedId] = useState('');

  // Build the dropdown options from all remaining assignments across all groups
  const options = useMemo(() => {
    const list = [];
    for (const group of (groupResults || [])) {
      for (const a of (group.assignments || [])) {
        if (isPanicEligible(a)) {
          list.push({ id: String(a.id), name: a.name, groupName: group.name, pts: a.points_possible });
        }
      }
    }
    return list;
  }, [groupResults]);

  const result = useMemo(() => {
    if (!selectedId || targetPercent === null || !groupResults) return null;
    return solvePanic(groupResults, targetPercent, selectedId, isWeighted);
  }, [selectedId, targetPercent, groupResults, isWeighted]);

  const noTarget = targetPercent === null;

  return (
    <div className="ck-panic-body">
      <div className="ck-spacer-md" />

      {noTarget && (
        <div className="ck-empty" style={{ padding: '12px 0' }}>
          Set a target grade above first.
        </div>
      )}

      {!noTarget && options.length === 0 && (
        <div className="ck-empty" style={{ padding: '12px 0' }}>
          No upcoming assignments found.
        </div>
      )}

      {!noTarget && options.length > 0 && (
        <>
          <label className="ck-label" htmlFor="ck-panic-select">
            Which assignment is your final / the one that matters?
          </label>
          <select
            id="ck-panic-select"
            className="ck-select"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            <option value="">Select assignment…</option>
            {(() => {
              // Group options by assignment group for easier scanning
              const groups = [];
              let lastGroup = null;
              for (const o of options) {
                if (o.groupName !== lastGroup) {
                  lastGroup = o.groupName;
                  groups.push({ name: lastGroup, items: [o] });
                } else {
                  groups[groups.length - 1].items.push(o);
                }
              }
              return groups.map(g => (
                <optgroup key={g.name} label={g.name}>
                  {g.items.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.pts} pts)
                    </option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>

          {result && (
            <div className="ck-result-card" role="status" aria-live="polite">
              <p className="ck-result-label">
                To get {percentToLetter(targetPercent)} ({targetPercent}%) you need on{' '}
                <strong style={{ color: 'var(--text)' }}>{result.assignmentName}</strong>:
              </p>

              {result.isAchieved ? (
                <>
                  <div className="ck-result-number is-achieved">Already there</div>
                  <p className="ck-result-sub">
                    You'd hit your target even with a 0 on this one.
                  </p>
                </>
              ) : result.isImpossible ? (
                <>
                  <div className="ck-result-number is-impossible">
                    {result.requiredPercent.toFixed(1)}%
                  </div>
                  <p className="ck-result-sub">
                    That's above 100% — not achievable. Consider adjusting your target.
                  </p>
                  {(() => {
                    const bestGrade = projectGrade(groupResults, selectedId, 100, isWeighted);
                    if (bestGrade !== null) {
                      return (
                        <p className="ck-result-best">
                          Best possible with 100%: <strong>{bestGrade.toFixed(1)}%</strong> ({percentToLetter(bestGrade)})
                        </p>
                      );
                    }
                    return null;
                  })()}
                </>
              ) : (
                <>
                  <div className="ck-result-number ck-mono">
                    {result.requiredPercent.toFixed(1)}%
                  </div>
                  <p className="ck-result-sub">
                    {result.requiredScore.toFixed(1)} / {result.pointsPossible} points
                    {result.requiredPercent > 90 && (
                      <span style={{ color: 'var(--yellow)', marginLeft: '8px' }}>
                        High bar — plan for it
                      </span>
                    )}
                  </p>
                </>
              )}

              <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '10px' }}>
                Assumes average performance on all other remaining assignments.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
