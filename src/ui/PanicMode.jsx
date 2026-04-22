import { useState, useMemo } from 'react';
import { solvePanic, percentToLetter, isPanicEligible } from '../math/gradeEngine';

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
            {options.map(o => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.pts} pts)
              </option>
            ))}
          </select>

          {result && (
            <div className="ck-result-card">
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
