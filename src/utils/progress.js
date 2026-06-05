const STORAGE_KEY = "toefl-progress-v1";

export const PROGRESS_SECTIONS = [
  { key: "reading_complete", group: "Reading", label: "Complete the Words" },
  { key: "reading_daily", group: "Reading", label: "Read in Daily Life" },
  { key: "reading_academic", group: "Reading", label: "Read an Academic Passage" },
  { key: "writing_sentence", group: "Writing", label: "Build a Sentence" },
  { key: "writing_email", group: "Writing", label: "Write an Email" },
  { key: "writing_discussion", group: "Writing", label: "Write for an Academic Discussion" },
  { key: "speaking_interview", group: "Speaking", label: "Take an Interview" },
];

export function readProgress() {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function clearProgress() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getSectionResults(sectionKey) {
  return readProgress()[sectionKey]?.byProblem ?? {};
}

export function recordSectionAttempt(sectionKey, problemIndex, correct) {
  const progress = readProgress();
  const section = progress[sectionKey] ?? { attempts: [], byProblem: {} };
  const result = Boolean(correct);
  const attempt = {
    correct: result,
    problemIndex,
    timestamp: Date.now(),
  };

  const nextSection = {
    attempts: [attempt, ...(section.attempts ?? [])].slice(0, 100),
    byProblem: {
      ...(section.byProblem ?? {}),
      [problemIndex]: [result, ...((section.byProblem ?? {})[problemIndex] ?? [])].slice(0, 3),
    },
  };

  const nextProgress = {
    ...progress,
    [sectionKey]: nextSection,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProgress));
  return nextSection.byProblem;
}

export function getRecentAccuracy(sectionKey, limit = 20) {
  const attempts = readProgress()[sectionKey]?.attempts ?? [];
  const recent = attempts.slice(0, limit);
  const correct = recent.filter((attempt) => attempt.correct).length;

  return {
    attempted: recent.length,
    correct,
    percent: recent.length ? Math.round((correct / recent.length) * 100) : null,
  };
}

export function getGroupRecentAccuracy(group, limit = 20) {
  const progress = readProgress();
  const sectionKeys = PROGRESS_SECTIONS
    .filter((section) => section.group === group)
    .map((section) => section.key);
  const recent = sectionKeys
    .flatMap((key) => progress[key]?.attempts ?? [])
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, limit);
  const correct = recent.filter((attempt) => attempt.correct).length;

  return {
    attempted: recent.length,
    correct,
    percent: recent.length ? Math.round((correct / recent.length) * 100) : null,
  };
}
