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

// 기본 단일 문제 기록 (Complete the Words, Build a Sentence, Speaking)
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
    attempts: [attempt, ...(section.attempts ?? [])].slice(0, 500),
    byProblem: {
      ...(section.byProblem ?? {}),
      [problemIndex]: [result, ...((section.byProblem ?? {})[problemIndex] ?? [])].slice(0, 3),
    },
  };

  const nextProgress = { ...progress, [sectionKey]: nextSection };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProgress));
  return nextSection.byProblem;
}

// MC 문제들을 개별 attempt로 기록 (Read in Daily Life, Read Academic)
// correctMap: { 1: true, 2: false, 3: true } 형태
export function recordMcAttempts(sectionKey, problemIndex, correctMap) {
  const progress = readProgress();
  const section = progress[sectionKey] ?? { attempts: [], byProblem: {} };
  const now = Date.now();

  const newAttempts = Object.entries(correctMap).map(([qNum, correct]) => ({
    correct: Boolean(correct),
    problemIndex,
    qNum: Number(qNum),
    timestamp: now,
  }));

  // byProblem: problemIndex별로 전체 정오 배열 저장 [true, false, true, ...]
  const prevByProblem = section.byProblem ?? {};
  const prevResults = prevByProblem[problemIndex] ?? [];
  const newResults = Object.values(correctMap).map(Boolean);

  const nextSection = {
    attempts: [...newAttempts, ...(section.attempts ?? [])].slice(0, 500),
    byProblem: {
      ...prevByProblem,
      [problemIndex]: [...newResults, ...prevResults].slice(0, 15),
    },
  };

  const nextProgress = { ...progress, [sectionKey]: nextSection };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProgress));
  return nextSection.byProblem;
}

// 글쓰기 단어수 기록 (Write an Email, Academic Discussion)
export function recordWordCount(sectionKey, problemIndex, wordCount) {
  const progress = readProgress();
  const section = progress[sectionKey] ?? { wordCounts: [], byProblem: {} };
  const entry = { wordCount, problemIndex, timestamp: Date.now() };

  const nextSection = {
    ...section,
    wordCounts: [entry, ...(section.wordCounts ?? [])].slice(0, 500),
    byProblem: {
      ...(section.byProblem ?? {}),
      [problemIndex]: [wordCount, ...((section.byProblem ?? {})[problemIndex] ?? [])].slice(0, 3),
    },
  };

  const nextProgress = { ...progress, [sectionKey]: nextSection };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProgress));
  return nextSection.byProblem;
}

// 전체 정답률 (Complete the Words, Build a Sentence)
export function getAccuracy(sectionKey) {
  const attempts = readProgress()[sectionKey]?.attempts ?? [];
  const correct = attempts.filter((a) => a.correct).length;
  return {
    attempted: attempts.length,
    correct,
    percent: attempts.length ? Math.round((correct / attempts.length) * 100) : null,
  };
}

// MC 개별 문제 기준 전체 정답률 (Read in Daily Life, Read Academic)
export function getMcAccuracy(sectionKey) {
  const attempts = readProgress()[sectionKey]?.attempts ?? [];
  const correct = attempts.filter((a) => a.correct).length;
  return {
    attempted: attempts.length,
    correct,
    percent: attempts.length ? Math.round((correct / attempts.length) * 100) : null,
  };
}

// 글쓰기 평균 단어수
export function getAvgWordCount(sectionKey) {
  const wordCounts = readProgress()[sectionKey]?.wordCounts ?? [];
  if (!wordCounts.length) return { attempted: 0, avg: null };
  const avg = Math.round(wordCounts.reduce((sum, e) => sum + e.wordCount, 0) / wordCounts.length);
  return { attempted: wordCounts.length, avg };
}

// 인터뷰 푼 문제 수
export function getInterviewCount(sectionKey) {
  const byProblem = readProgress()[sectionKey]?.byProblem ?? {};
  return Object.keys(byProblem).length;
}

// 그룹 전체 정답률 (Reading, Writing 요약용)
export function getGroupAccuracy(group) {
  const progress = readProgress();
  const accuracySections = ["reading_complete", "reading_daily", "reading_academic", "writing_sentence"];
  const sectionKeys = PROGRESS_SECTIONS
    .filter((s) => s.group === group && accuracySections.includes(s.key))
    .map((s) => s.key);

  const allAttempts = sectionKeys.flatMap((key) => progress[key]?.attempts ?? []);
  const correct = allAttempts.filter((a) => a.correct).length;
  return {
    attempted: allAttempts.length,
    correct,
    percent: allAttempts.length ? Math.round((correct / allAttempts.length) * 100) : null,
  };
}