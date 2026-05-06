import { useState, useEffect } from 'react';
import { percentToLetterWithScheme } from '../math/gradeEngine';

function formatTimeAgo(ts) {
  if (!ts) return null;
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export default function GradeDisplay({ grade, canvasGrade, isWeighted, gradingScheme, lastRefreshed }) {
  const letter = grade !== null ? percentToLetterWithScheme(grade, gradingScheme) : null;

  const hasDiscrepancy =
    grade !== null &&
    canvasGrade?.currentScore !== null &&
    canvasGrade?.currentScore !== undefined &&
    Math.abs(grade - canvasGrade.currentScore) > 0.5;

  const discrepancyDelta = hasDiscrepancy
    ? (grade - canvasGrade.currentScore).toFixed(1)
    : null;

  const gradeColor = grade === null
    ? 'var(--text-2)'
    : grade >= 90 ? 'var(--green)'
    : grade >= 70 ? 'var(--text)'
    : 'var(--red)';

  // Auto-updating time-ago label — refreshes every 30s while mounted
  const [refreshedLabel, setRefreshedLabel] = useState(() => formatTimeAgo(lastRefreshed));
  useEffect(() => {
    if (!lastRefreshed) return;
    const update = () => setRefreshedLabel(formatTimeAgo(lastRefreshed));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [lastRefreshed]);

  return (
    <div>
      <div className="ck-grade-row">
        <span className="ck-grade-pct ck-mono" style={{ color: gradeColor }}>
          {grade !== null ? `${grade.toFixed(1)}%` : '—'}
        </span>
        {letter && (
          <span className="ck-grade-letter">{letter}</span>
        )}
        {canvasGrade?.currentGrade && (
          <span className="ck-grade-canvas-letter">{canvasGrade.currentGrade}</span>
        )}
      </div>

      <p className="ck-grade-meta">
        {isWeighted ? 'Weighted groups' : 'Total points'} · calculated from Canvas data
        {refreshedLabel && (
          <> · <span className="ck-grade-refreshed">{refreshedLabel}</span></>
        )}
      </p>

      {hasDiscrepancy && (
        <div className="ck-discrepancy">
          <strong>Canvas shows {canvasGrade.currentScore?.toFixed(1)}%</strong>
          {discrepancyDelta > 0 && (
            <> — our calc is <span style={{ color: 'var(--green-hi)' }}>+{discrepancyDelta}%</span> higher</>
          )}
          {discrepancyDelta < 0 && (
            <> — our calc is <span style={{ color: 'var(--red-hi)' }}>{discrepancyDelta}%</span> lower</>
          )}
          . Usually caused by hidden or unposted assignments.
        </div>
      )}
    </div>
  );
}
