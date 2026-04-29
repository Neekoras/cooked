import { percentToGPA, percentToLetter, calcGPA } from '../math/gradeEngine';

function LoadingState() {
  return (
    <div className="ck-loading">
      <div className="ck-spinner" />
      <p className="ck-loading-text">Loading courses…</p>
    </div>
  );
}

function CourseRow({ course, isActive, onSelect }) {
  const { currentScore: score, currentGrade: canvasGrade } = course;
  const letter = canvasGrade ?? (score !== null ? percentToLetter(score) : null);
  const gpaPoints = score !== null ? percentToGPA(score) : null;

  const scoreColor =
    score === null ? 'var(--text-3)'
    : score >= 90  ? 'var(--green)'
    : score >= 80  ? 'var(--text)'
    : score >= 70  ? 'var(--yellow)'
    : 'var(--red)';

  return (
    <button
      className={`ck-course-row ${isActive ? 'is-active' : ''}`}
      onClick={onSelect}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className="ck-course-info">
        <div className="ck-course-name">{course.name}</div>
        {gpaPoints !== null && (
          <div className="ck-course-gpa-pts">{gpaPoints.toFixed(1)} GPA pts</div>
        )}
      </div>
      <div className="ck-course-grade" style={{ color: scoreColor }}>
        {score !== null ? (
          <>
            <div className="ck-course-letter">{letter}</div>
            <div className="ck-course-pct">{score.toFixed(1)}%</div>
          </>
        ) : (
          <div style={{ color: 'var(--text-3)', fontSize: '12px' }}>—</div>
        )}
      </div>
    </button>
  );
}

export default function CourseList({ courses, status, activeCourseId, onSelect }) {
  if (status === 'loading' || status === 'idle') return <LoadingState />;
  if (status === 'error') return (
    <div className="ck-empty">Couldn't load courses.</div>
  );

  const gpa = calcGPA(courses.map(c => ({ currentScore: c.currentScore, currentGrade: c.currentGrade })));
  const gradedCount = courses.filter(c => c.currentScore !== null).length;

  return (
    <div>
      <div className="ck-gpa-block">
        <div className="ck-gpa-number ck-mono">
          {gpa !== null ? gpa.toFixed(2) : '—'}
        </div>
        <div className="ck-gpa-label">
          Estimated GPA · {gradedCount} {gradedCount === 1 ? 'course' : 'courses'}
        </div>
      </div>

      <div className="ck-section-title">Your courses</div>

      {courses.length === 0 && (
        <div className="ck-empty">No active courses found.</div>
      )}

      {courses.map(course => (
        <CourseRow
          key={course.id}
          course={course}
          isActive={String(course.id) === String(activeCourseId)}
          onSelect={() => onSelect(course.id)}
        />
      ))}
    </div>
  );
}
