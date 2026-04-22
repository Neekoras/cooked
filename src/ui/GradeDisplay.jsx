import { percentToLetterWithScheme } from '../math/gradeEngine';

export default function GradeDisplay({ grade, canvasGrade, isWeighted, gradingScheme }) {
  const letter = grade !== null ? percentToLetterWithScheme(grade, gradingScheme) : null;

  const hasDiscrepancy =
    grade !== null &&
    canvasGrade?.currentScore !== null &&
    canvasGrade?.currentScore !== undefined &&
    Math.abs(grade - canvasGrade.currentScore) > 0.5;

  const gradeColor = grade === null
    ? 'var(--text-2)'
    : grade >= 90 ? 'var(--green)'
    : grade >= 70 ? 'var(--text)'
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
      </div>

      <p className="ck-grade-meta">
        {isWeighted ? 'Weighted groups' : 'Total points'} · calculated from Canvas data
      </p>

      {hasDiscrepancy && (
        <div className="ck-discrepancy">
          <strong>Canvas shows {canvasGrade.currentScore?.toFixed(1)}%</strong>
          {' '}— our calculation says {grade.toFixed(1)}%.{' '}
          This is usually caused by hidden grades or unsubmitted assignments
          being counted differently.
        </div>
      )}
    </div>
  );
}
