import { percentToLetterWithScheme } from '../math/gradeEngine';

export default function GradeDisplay({ grade, canvasGrade, isWeighted, gradingScheme }) {
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
    : grade >= 80 ? 'var(--green)'
    : grade >= 60 ? 'var(--text)'
    : 'var(--red)';

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
