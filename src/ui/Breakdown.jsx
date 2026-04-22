import { useState } from 'react';
import { isGraded } from '../math/gradeEngine';

function formatDue(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function AssignmentRow({ assignment, inverseResult, isDropped }) {
  const graded = isGraded(assignment);
  const sub = assignment.submission;
  const score = graded ? sub?.score : null;
  const possible = assignment.points_possible;
  const pct = graded && possible > 0 ? (score / possible) * 100 : null;

  const due = formatDue(assignment.due_at);

  let className = 'ck-assignment';
  if (isDropped) className += ' is-dropped';
  else if (graded) className += ' is-graded';

  const scoreColor =
    pct === null ? 'var(--text-2)'
    : pct >= 90   ? 'var(--green)'
    : pct >= 70   ? 'var(--text)'
    : 'var(--red)';

  // Right-side content for ungraded assignments
  let ungraded = null;
  if (!graded) {
    if (isDropped) {
      ungraded = null;
    } else if (!inverseResult) {
      ungraded = <span style={{ color: 'var(--text-3)' }}>—</span>;
    } else if (inverseResult.isAchieved) {
      ungraded = <span className="ck-chip ck-chip-achieved">on track</span>;
    } else if (inverseResult.isImpossible) {
      ungraded = <span className="ck-chip ck-chip-impossible">not possible</span>;
    } else {
      const reqPct = inverseResult.requiredPercent;
      const chipClass = reqPct > 100 ? 'ck-chip ck-chip-impossible'
                      : reqPct > 90  ? 'ck-chip ck-chip-high'
                      : 'ck-chip ck-chip-achieved';
      ungraded = (
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 600 }}>
            {inverseResult.requiredScore.toFixed(1)}/{possible} pts
          </div>
          <span className={chipClass}>{reqPct.toFixed(1)}%</span>
        </div>
      );
    }
  }

  return (
    <div className={className}>
      <div className="ck-a-name">
        {assignment.name}
        <span className="ck-a-due">
          {[
            due,
            assignment.score_statistics?.mean != null && possible > 0
              ? `class avg ${((assignment.score_statistics.mean / possible) * 100).toFixed(0)}%`
              : null,
          ].filter(Boolean).join(' · ')}
        </span>
      </div>

      <div className="ck-a-score" style={{ color: scoreColor }}>
        {graded ? (
          <>
            {score}/{possible}
            <span className="ck-a-needed">
              {pct !== null ? `${pct.toFixed(0)}%` : ''}
            </span>
          </>
        ) : ungraded}
        {isDropped && <span className="ck-chip ck-chip-dropped">dropped</span>}
      </div>
    </div>
  );
}

function GroupSection({ group, inverseMap }) {
  const [open, setOpen] = useState(true);
  const score = group.score;

  const scoreColor =
    score.percent === null ? 'var(--text-3)'
    : score.percent >= 90  ? 'var(--green)'
    : score.percent >= 70  ? 'var(--text)'
    : 'var(--red)';

  const allAssignments = (group.assignments || []).filter(
    a => (a.points_possible > 0) || isGraded(a)
  );

  if (allAssignments.length === 0) return null;

  return (
    <div className="ck-group">
      <div className="ck-group-header" onClick={() => setOpen(v => !v)}>
        <span className="ck-group-name">{group.name}</span>
        {group.group_weight != null && (
          <span className="ck-group-weight">{group.group_weight}%</span>
        )}
        <span className="ck-group-score ck-mono" style={{ color: scoreColor }}>
          {score.percent !== null ? `${score.percent.toFixed(1)}%` : 'No grades'}
        </span>
        <span className={`ck-chevron ${open ? 'is-open' : ''}`}>▾</span>
      </div>

      {open && allAssignments.map(a => (
        <AssignmentRow
          key={a.id}
          assignment={a}
          inverseResult={inverseMap[a.id]}
          isDropped={group.score.droppedIds?.has(a.id)}
        />
      ))}
    </div>
  );
}

export default function Breakdown({ groupResults, inverseResults }) {
  // Index inverse results by assignmentId for O(1) lookup
  const inverseMap = {};
  for (const r of (inverseResults || [])) {
    inverseMap[r.assignmentId] = r;
  }

  if (!groupResults || groupResults.length === 0) {
    return <div className="ck-empty">No assignment groups found.</div>;
  }

  return (
    <div>
      <div className="ck-section-title">Assignment breakdown</div>
      {groupResults.map(g => (
        <GroupSection key={g.id} group={g} inverseMap={inverseMap} />
      ))}
    </div>
  );
}
