/**
 * canvasClient.js — All Canvas API calls.
 *
 * Uses the student's existing session cookie via credentials: "include".
 * No OAuth, no API keys, no auth flow.
 */

const PER_PAGE = 100;

/** Extract courseId from the current page URL. */
export function getCourseId() {
  const match = window.location.pathname.match(/\/courses\/(\d+)\/grades/);
  return match ? match[1] : null;
}

/**
 * Follow Canvas's Link header pagination and collect all pages.
 * Returns the full array of results.
 */
async function fetchPaged(url) {
  const results = [];
  let next = url;

  while (next) {
    const res = await fetch(next, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Canvas API ${res.status}: ${res.statusText} (${next})`);
    }

    const data = await res.json();

    if (Array.isArray(data)) {
      results.push(...data);
    } else {
      return data; // single-object endpoints (course settings)
    }

    next = parseLinkNext(res.headers.get('Link'));
  }

  return results;
}

function parseLinkNext(header) {
  if (!header) return null;
  const m = header.match(/<([^>]+)>;\s*rel="next"/);
  return m ? m[1] : null;
}

/**
 * Fetch assignment groups with assignments and student submissions included.
 *
 * Canvas API: GET /api/v1/courses/:id/assignment_groups
 *   ?include[]=assignments
 *   &include[]=submission
 *   &include[]=score_statistics
 */
export async function fetchAssignmentGroups(courseId) {
  const url =
    `/api/v1/courses/${courseId}/assignment_groups` +
    `?include[]=assignments&include[]=submission&include[]=score_statistics` +
    `&per_page=${PER_PAGE}`;
  return fetchPaged(url);
}

/**
 * Fetch the course object to read apply_assignment_group_weights.
 */
export async function fetchCourse(courseId) {
  const url = `/api/v1/courses/${courseId}`;
  return fetchPaged(url);
}

/**
 * Fetch the student's Canvas-computed enrollment grades for discrepancy detection.
 * Returns null gracefully if unavailable.
 */
export async function fetchEnrollmentGrade(courseId) {
  try {
    const url =
      `/api/v1/courses/${courseId}/enrollments` +
      `?user_id=self&type[]=StudentEnrollment&per_page=1`;
    const list = await fetchPaged(url);
    const grades = list[0]?.grades ?? null;
    return grades
      ? {
          currentScore: grades.current_score ?? null,
          finalScore: grades.final_score ?? null,
          currentGrade: grades.current_grade ?? null,
        }
      : null;
  } catch {
    return null; // non-critical, degrade gracefully
  }
}

/**
 * Load everything needed for the grade calculation in parallel.
 * Returns { groups, isWeighted, enrollmentGrade }.
 */
export async function loadCourseData(courseId) {
  const [groups, course, enrollmentGrade] = await Promise.all([
    fetchAssignmentGroups(courseId),
    fetchCourse(courseId).catch(() => null),
    fetchEnrollmentGrade(courseId),
  ]);

  const isWeighted = Boolean(course?.apply_assignment_group_weights);

  return { groups, isWeighted, enrollmentGrade };
}
