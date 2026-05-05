import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { loadCourseData, fetchAllCourses, getCourseId, setApiBase } from '../api/canvasClient';
import { calculateGrade, solveInverse, normalizeGradingScheme } from '../math/gradeEngine';
import GradeDisplay from './GradeDisplay';
import TargetInput from './TargetInput';
import Breakdown from './Breakdown';
import PanicMode from './PanicMode';
import ShareCard from './ShareCard';
import CourseList from './CourseList';

const COURSE_TABS = ['Breakdown', 'Panic', 'Share'];

// Subject-keyword → canonical abbreviation lookup.
// Checked against each word in the course name (after stripping punctuation).
// First match wins — order matters (e.g. "physical" should map to PE before
// "education" maps to EDU).
const SUBJECT_ABBREVS = {
  english:     'ENG',
  literature:  'LIT',
  composition: 'COMP',
  writing:     'WRIT',
  reading:     'READ',
  math:        'MATH',
  mathematics: 'MATH',
  algebra:     'ALG',
  geometry:    'GEOM',
  calculus:    'CALC',
  statistics:  'STAT',
  trigonometry:'TRIG',
  biology:     'BIO',
  chemistry:   'CHEM',
  physics:     'PHYS',
  science:     'SCI',
  history:     'HIST',
  geography:   'GEOG',
  government:  'GOV',
  economics:   'ECON',
  psychology:  'PSYCH',
  sociology:   'SOC',
  philosophy:  'PHIL',
  spanish:     'SPA',
  french:      'FRE',
  german:      'GER',
  latin:       'LAT',
  mandarin:    'MAN',
  chinese:     'CHN',
  japanese:    'JPN',
  art:         'ART',
  music:       'MUS',
  band:        'BAND',
  choir:       'CHOR',
  theater:     'THEA',
  drama:       'DRAM',
  dance:       'DANCE',
  physical:    'PE',
  health:      'HLTH',
  engineering: 'ENG',
  computer:    'CS',
  programming: 'CS',
  robotics:    'ROBO',
  business:    'BUS',
  marketing:   'MKTG',
  design:      'DES',
  photography:'PHOTO',
  journalism:  'JRN',
  speech:      'SPCH',
  debate:      'DEB',
};

// Noise words that appear in Canvas course names but carry no subject meaning.
// Stripped before building initialisms so "Period 3 English 10" → "English 10" → ENG.
const NOISE_WORDS = new Set([
  'period', 'per', 'p', 'sec', 'section', 'sect', 'sem', 'semester',
  'term', 'fall', 'spring', 'winter', 'summer', 'block', 'hr', 'hour',
  'ap', 'honors', 'hon', 'honour', 'advanced', 'intro', 'introduction',
  'foundations', 'foundation', 'fundamentals', 'prep', 'pre',
]);

function abbrev(course) {
  const name = course.name.trim();
  const words = name.split(/\s+/).filter(w => w.length > 0);

  // If it's 1-2 short words already (e.g. "PE", "Art"), use as-is
  if (words.length <= 2 && name.length <= 6) return name.toUpperCase();

  // 1. Try subject-keyword match against each word (after stripping punctuation/numbers)
  for (const w of words) {
    const clean = w.toLowerCase().replace(/[^a-z]/g, '');
    if (clean && SUBJECT_ABBREVS[clean]) return SUBJECT_ABBREVS[clean];
  }

  // 2. Filter out pure numbers, noise words, and section markers,
  //    then build an initialism from the remaining alphabetical words.
  const alphaWords = words.filter(w => {
    const clean = w.replace(/[^a-zA-Z]/g, '');
    if (!clean) return false;                       // pure number
    if (NOISE_WORDS.has(clean.toLowerCase())) return false; // noise
    return true;
  });

  if (alphaWords.length > 0) {
    // Short alpha name — use as-is
    if (alphaWords.length <= 2 && alphaWords.join('').length <= 6) {
      return alphaWords.join('').toUpperCase();
    }
    const initials = alphaWords.map(w => w.replace(/[^a-zA-Z]/g, '')[0]).join('').toUpperCase();
    if (initials.length >= 2 && initials.length <= 5) return initials;
    return alphaWords[0].replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
  }

  // 3. Fallback: first non-number word's first 4 chars
  const firstAlpha = words.find(w => /[a-zA-Z]/.test(w));
  return firstAlpha
    ? firstAlpha.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase()
    : words[0].slice(0, 4).toUpperCase();
}

function QuickSwitcher({ courses, activeCourseId, onSelect }) {
  if (!courses.length) return null;
  return (
    <div className="ck-quick-switcher">
      {courses.map(c => {
        const isActive = String(c.id) === String(activeCourseId);
        return (
          <button
            key={c.id}
            className={`ck-quick-btn ${isActive ? 'is-active' : ''}`}
            onClick={() => onSelect(c.id)}
            title={c.name}
          >
            {abbrev(c)}
          </button>
        );
      })}
    </div>
  );
}

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

export default function Sidebar({ isOpen = true, onToggle, embedded = false }) {
  // In embedded (side panel) mode, we must read the tab URL before any API calls.
  // apiReady gates all data fetching so we never fire requests with an empty base URL.
  const [apiReady, setApiReady] = useState(!embedded);
  const [urlCourseId, setUrlCourseId] = useState(embedded ? null : getCourseId());

  useEffect(() => {
    if (!embedded) return;
    function readUrl(url) {
      if (!url) return;
      try {
        const { origin } = new URL(url);
        if (/^https:\/\/[^/]+\.instructure\.com$/.test(origin)) {
          setApiBase(origin);
          setApiReady(true);
        }
      } catch {}
      const m = url.match(/\/courses\/(\d+)/);
      setUrlCourseId(m ? m[1] : null);
    }
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => readUrl(tab?.url));
    const listener = (_id, info) => { if (info.url) readUrl(info.url); };
    chrome.tabs.onUpdated.addListener(listener);
    return () => chrome.tabs.onUpdated.removeListener(listener);
  }, [embedded]);

  // Navigation
  const [view, setView] = useState('course'); // 'course' | 'courses'
  const [activeCourseId, setActiveCourseId] = useState(urlCourseId);
  const [activeTab, setActiveTab] = useState('Breakdown');
  const [targetPercent, setTargetPercent] = useState(null);

  // Course list (all courses overview)
  const [courseList, setCourseList] = useState([]);
  const [coursesStatus, setCoursesStatus] = useState('idle');

  // Per-course grade data — cached by course ID
  const courseCache = useRef({});
  // Tracks the latest load request to discard stale responses on fast switching
  const loadRequestRef = useRef(0);
  const [courseData, setCourseData] = useState({
    status: 'idle',
    groups: null,
    isWeighted: false,
    enrollmentGrade: null,
    gradingScheme: null,
    error: null,
  });

  // When tab navigates to a new course, update the active course
  useEffect(() => {
    if (urlCourseId) setActiveCourseId(urlCourseId);
  }, [urlCourseId]);

  // In embedded mode, sidebar is always "open"
  const open = embedded ? true : isOpen;

  // Load course list once the API is ready
  useEffect(() => {
    if (!open || !apiReady || coursesStatus !== 'idle') return;
    setCoursesStatus('loading');
    fetchAllCourses()
      .then(courses => {
        setCourseList(courses);
        setCoursesStatus('ready');
      })
      .catch(() => setCoursesStatus('error'));
  }, [open, coursesStatus, apiReady]);

  // Load grade data for the active course (with cache)
  useEffect(() => {
    if (!open || !apiReady || !activeCourseId) return;

    if (courseCache.current[activeCourseId]) {
      setCourseData({ ...courseCache.current[activeCourseId], status: 'ready', error: null });
      return;
    }

    setCourseData({ status: 'loading', groups: null, isWeighted: false, enrollmentGrade: null, error: null });

    const requestId = ++loadRequestRef.current;

    loadCourseData(activeCourseId)
      .then(({ groups, isWeighted, enrollmentGrade, gradingScheme }) => {
        if (requestId !== loadRequestRef.current) return; // stale — user switched course
        const entry = { groups, isWeighted, enrollmentGrade, gradingScheme: normalizeGradingScheme(gradingScheme) };
        courseCache.current[activeCourseId] = entry;
        setCourseData({ ...entry, status: 'ready', error: null });
      })
      .catch(err => {
        if (requestId !== loadRequestRef.current) return;
        setCourseData({ status: 'error', groups: null, isWeighted: false, enrollmentGrade: null, error: err.message });
      });
  }, [open, apiReady, activeCourseId]);

  const { grade, groupResults } = useMemo(() => {
    if (!courseData.groups) return { grade: null, groupResults: [] };
    return calculateGrade(courseData.groups, courseData.isWeighted);
  }, [courseData.groups, courseData.isWeighted]);

  const inverseResults = useMemo(() => {
    if (!groupResults || targetPercent === null) return [];
    return solveInverse(groupResults, targetPercent, courseData.isWeighted);
  }, [groupResults, targetPercent, courseData.isWeighted]);

  const handleCourseSelect = useCallback((courseId) => {
    const id = String(courseId);
    if (!/^\d+$/.test(id)) return; // reject non-numeric IDs
    setActiveCourseId(id);
    setView('course');
    setActiveTab('Breakdown');
    setTargetPercent(null);
    // Navigate the browser tab to that course's grades page
    const target = `/courses/${id}/grades`;
    if (embedded) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.url) return;
        try {
          const url = new URL(tab.url);
          if (!url.pathname.startsWith(target)) {
            chrome.tabs.update(tab.id, { url: url.origin + target });
          }
        } catch {}
      });
    } else if (!window.location.pathname.startsWith(target)) {
      window.location.href = target;
    }
  }, [embedded]);

  const activeCourse = courseList.find(c => String(c.id) === String(activeCourseId));

  const panelStyle = useMemo(() => embedded ? {
    position: 'relative',
    width: '100%',
    height: '100%',
    transform: 'none',
    borderLeft: 'none',
    boxShadow: 'none',
    zIndex: 'auto',
  } : {}, [embedded]);

  return (
    <>
      {/* Slide-out tab — only in overlay (non-embedded) mode */}
      {!embedded && (
        <button
          className={`ck-tab ${open ? 'is-open' : ''}`}
          onClick={onToggle}
          aria-label={open ? 'Close Cooked' : 'Open Cooked'}
          style={{
            position: 'fixed',
            top: '50%',
            right: open ? '360px' : '0',
            transform: 'translateY(-50%)',
            zIndex: 2147483646,
            cursor: 'pointer',
            background: '#151210',
            border: '1px solid #2C2720',
            borderRight: 'none',
            borderRadius: '6px 0 0 6px',
            color: '#C89A2C',
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
          {open ? '✕' : 'COOKED'}
        </button>
      )}

      {/* Panel */}
      <div
        className={`ck-panel ${embedded ? 'is-open' : open ? 'is-open' : ''}`}
        aria-hidden={!open}
        style={panelStyle}
      >

        {/* Header */}
        <div className="ck-header">
          <div className="ck-header-top">
            {view === 'course' ? (
              <>
                <div className="ck-wordmark">Cooked?</div>
                <button className="ck-courses-btn" onClick={() => setView('courses')}>
                  All Courses
                </button>
              </>
            ) : (
              <>
                <button className="ck-back-btn" onClick={() => setView('course')}>
                  ← Back
                </button>
                <div className="ck-wordmark">Cooked?</div>
              </>
            )}
          </div>

          {view === 'course' && activeCourse && (
            <div className="ck-course-title-header">{activeCourse.name}</div>
          )}

          {view === 'course' && courseData.status === 'ready' && grade !== null && (
            <GradeDisplay
              grade={grade}
              canvasGrade={courseData.enrollmentGrade}
              isWeighted={courseData.isWeighted}
              gradingScheme={courseData.gradingScheme}
            />
          )}
        </div>

        {/* Quick course switcher */}
        {coursesStatus === 'ready' && courseList.length > 1 && (
          <QuickSwitcher
            courses={courseList}
            activeCourseId={activeCourseId}
            onSelect={handleCourseSelect}
          />
        )}

        {/* Target input */}
        {view === 'course' && courseData.status === 'ready' && (
          <TargetInput onChange={setTargetPercent} gradingScheme={courseData.gradingScheme} />
        )}

        {/* Tab bar */}
        {view === 'course' && courseData.status === 'ready' && (
          <div className="ck-tabs" role="tablist">
            {COURSE_TABS.map(tab => (
              <button
                key={tab}
                className={`ck-tab-btn ${activeTab === tab ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`ck-panel-${tab.toLowerCase()}`}
                id={`ck-tab-${tab.toLowerCase()}`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div className="ck-scroll">
          {view === 'courses' && (
            <CourseList
              courses={courseList}
              status={coursesStatus}
              activeCourseId={activeCourseId}
              onSelect={handleCourseSelect}
            />
          )}

          {view === 'course' && !apiReady && (
            <div className="ck-empty" style={{ paddingTop: 40 }}>
              Open a Canvas page first, then come back here.
            </div>
          )}

          {view === 'course' && apiReady && (
            <>
              {courseData.status === 'loading' && <LoadingState />}
              {courseData.status === 'error' && <ErrorState message={courseData.error} />}
              {courseData.status === 'ready' && (
                <>
                  <div
                    id="ck-panel-breakdown"
                    role="tabpanel"
                    aria-labelledby="ck-tab-breakdown"
                    hidden={activeTab !== 'Breakdown'}
                  >
                    <Breakdown
                      groupResults={groupResults}
                      inverseResults={inverseResults}
                    />
                  </div>
                  <div
                    id="ck-panel-panic"
                    role="tabpanel"
                    aria-labelledby="ck-tab-panic"
                    hidden={activeTab !== 'Panic'}
                  >
                    <PanicMode
                      groupResults={groupResults}
                      targetPercent={targetPercent}
                      isWeighted={courseData.isWeighted}
                    />
                  </div>
                  <div
                    id="ck-panel-share"
                    role="tabpanel"
                    aria-labelledby="ck-tab-share"
                    hidden={activeTab !== 'Share'}
                  >
                    <ShareCard
                      grade={grade}
                      targetPercent={targetPercent}
                      inverseResults={inverseResults}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
