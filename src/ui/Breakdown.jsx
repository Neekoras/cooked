import { useState } from 'react';
import { isGraded } from '../math/gradeEngine';

function formatDue(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ScoreChip({ result }) {
  if (!result) return null;
  if (result.isAchieved) {
    return <span className="ck-chip ck-chip-achieved">On track</span>;
  }
  if (result.isImpossible) {
    return <span className="ck-chip ck-chip-impossible">Not possible</span>;
  }
  if (result.requiredPercent > 90) {
    return <span className="ck-chip ck-chip-high">{result.requiredPercent.toFixed(0)}% needed</span>;
  }
  return null;
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

  return (
    <div className={className}>
      <div className="ck-a-name">
        {assignment.name}
        {due && <span className="ck-a-due">{due}</span>}
      </div>

      <div className="ck-a-score" style={{ color: scoreColor }}>
        {graded ? (
          <>
            {score}/{possible}
            <span className="ck-a-needed">
              {pct !== null ? `${pct.toFixed(0)}%` : ''}
            </span>
          </>
        ) : (
          <>
            <ScoreChip result={inverseResult} />
            {!inverseResult?.isAchieved && !inverseResult?.isImpossible && inverseResult && (
              <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 600 }}>
                {inverseResult.requiredPercent.toFixed(1)}%
                <span className="ck-a-needed">
                  {inverseResult.requiredScore.toFixed(1)}/{possible} pts
                </span>
              </span>
            )}
            {!inverseResult && (
              <span style={{ color: 'var(--text-3)' }}>—</span>
            )}
          </>
        )}
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
