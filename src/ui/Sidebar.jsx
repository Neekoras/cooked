import { useState, useEffect, useMemo } from 'react';
import { loadCourseData, getCourseId } from '../api/canvasClient';
import { calculateGrade, solveInverse } from '../math/gradeEngine';
import GradeDisplay from './GradeDisplay';
import TargetInput from './TargetInput';
import Breakdown from './Breakdown';
import PanicMode from './PanicMode';
import ShareCard from './ShareCard';

const TABS = ['Breakdown', 'Panic', 'Share'];

function LoadingState() {
  return (
    <div className="ck-loading">
      <div className="ck-spinner" />
      <p className="ck-loading-text">Loading grades…</p>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="ck-error">
      <p className="ck-error-title">Couldn't load grades</p>
      <p className="ck-error-body">
        {message}
        <br /><br />
        Make sure you're on a Canvas grades page and logged in.
      </p>
    </div>
  );
}

export default function Sidebar({ isOpen, onToggle }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState(null);
  const [rawGroups, setRawGroups] = useState(null);
  const [isWeighted, setIsWeighted] = useState(false);
  const [enrollmentGrade, setEnrollmentGrade] = useState(null);
  const [targetPercent, setTargetPercent] = useState(null);
  const [activeTab, setActiveTab] = useState('Breakdown');

  // Load data once when the sidebar first opens
  useEffect(() => {
    if (!isOpen || status !== 'idle') return;

    const courseId = getCourseId();
    if (!courseId) {
      setError('Could not detect a course ID in the URL.');
      setStatus('error');
      return;
    }

    setStatus('loading');

    loadCourseData(courseId)
      .then(({ groups, isWeighted: w, enrollmentGrade: eg }) => {
        setRawGroups(groups);
        setIsWeighted(w);
        setEnrollmentGrade(eg);
        setStatus('ready');
      })
      .catch(err => {
        setError(err.message || 'An unknown error occurred.');
        setStatus('error');
      });
  }, [isOpen, status]);

  const { grade, groupResults, totalRemaining } = useMemo(() => {
    if (!rawGroups) return { grade: null, groupResults: [], totalRemaining: 0 };
    return calculateGrade(rawGroups, isWeighted);
  }, [rawGroups, isWeighted]);

  const inverseResults = useMemo(() => {
    if (!groupResults || targetPercent === null) return [];
    return solveInverse(groupResults, targetPercent, isWeighted);
  }, [groupResults, targetPercent, isWeighted]);

  return (
    <>
      {/* Slide-out tab — inline styles are fallback in case CSS fails to inject */}
      <button
        className={`ck-tab ${isOpen ? 'is-open' : ''}`}
        onClick={onToggle}
        aria-label={isOpen ? 'Close Cooked' : 'Open Cooked'}
        style={{
          position: 'fixed',
          top: '50%',
          right: isOpen ? '360px' : '0',
          transform: 'translateY(-50%)',
          zIndex: 2147483646,
          cursor: 'pointer',
          background: '#13161F',
          border: '1px solid #252836',
          borderRight: 'none',
          borderRadius: '6px 0 0 6px',
          color: '#C9A84C',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          padding: '14px 7px',
          writingMode: 'vertical-rl',
          transition: 'right 300ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {isOpen ? '✕' : 'COOKED'}
      </button>

      {/* Panel */}
      <div className={`ck-panel ${isOpen ? 'is-open' : ''}`} aria-hidden={!isOpen}>

        {/* Header */}
        <div className="ck-header">
          <div className="ck-wordmark">Cooked?</div>
          {status === 'ready' && grade !== null && (
            <GradeDisplay
              grade={grade}
              canvasGrade={enrollmentGrade}
              isWeighted={isWeighted}
            />
          )}
        </div>

        {/* Target input — always visible when ready */}
        {status === 'ready' && (
          <TargetInput onChange={setTargetPercent} />
        )}

        {/* Tab bar */}
        {status === 'ready' && (
          <div className="ck-tabs" role="tablist">
            {TABS.map(tab => (
              <button
                key={tab}
                className={`ck-tab-btn ${activeTab === tab ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={activeTab === tab}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div className="ck-scroll">
          {status === 'idle' && (
            <div className="ck-empty">Open to calculate your grade.</div>
          )}
          {status === 'loading' && <LoadingState />}
          {status === 'error' && <ErrorState message={error} />}

          {status === 'ready' && (
            <>
              {activeTab === 'Breakdown' && (
                <Breakdown
                  groupResults={groupResults}
                  inverseResults={inverseResults}
                />
              )}
              {activeTab === 'Panic' && (
                <PanicMode
                  groupResults={groupResults}
                  targetPercent={targetPercent}
                  isWeighted={isWeighted}
                />
              )}
              {activeTab === 'Share' && (
                <ShareCard
                  grade={grade}
                  targetPercent={targetPercent}
                  inverseResults={inverseResults}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
