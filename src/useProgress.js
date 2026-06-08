import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext";
import { db } from "./firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

// users/{uid}/progress/{sectionKey}

const PROGRESS_SECTIONS = [
  { key: "reading_complete",   group: "Reading", label: "Complete the Words" },
  { key: "reading_daily",      group: "Reading", label: "Read in Daily Life" },
  { key: "reading_academic",   group: "Reading", label: "Read an Academic Passage" },
  { key: "writing_sentence",   group: "Writing", label: "Build a Sentence" },
  { key: "writing_email",      group: "Writing", label: "Write an Email" },
  { key: "writing_discussion", group: "Writing", label: "Write for an Academic Discussion" },
  { key: "speaking_interview", group: "Speaking", label: "Take an Interview" },
];

function sectionRef(uid, sectionKey) {
  return doc(db, "users", uid, "progress", sectionKey);
}

async function readSection(uid, sectionKey) {
  const snap = await getDoc(sectionRef(uid, sectionKey));
  return snap.exists() ? snap.data() : { attempts: [], byProblem: {}, wordCounts: [] };
}

async function getSectionResults(uid, sectionKey) {
  const data = await readSection(uid, sectionKey);
  return data.byProblem ?? {};
}

// 단일 정오 기록 (Complete the Words, Build a Sentence, Speaking)
async function recordSectionAttempt(uid, sectionKey, problemIndex, correct) {
  const section = await readSection(uid, sectionKey);
  const result = Boolean(correct);
  const attempt = { correct: result, problemIndex, timestamp: Date.now() };
  const nextSection = {
    ...section,
    attempts: [attempt, ...(section.attempts ?? [])].slice(0, 500),
    byProblem: {
      ...(section.byProblem ?? {}),
      [problemIndex]: [result, ...((section.byProblem ?? {})[problemIndex] ?? [])].slice(0, 3),
    },
  };
  await setDoc(sectionRef(uid, sectionKey), nextSection);
  return nextSection.byProblem;
}

// MC 개별 문제 기록 (Read in Daily Life: 3문제, Read Academic: 5문제)
// correctMap: { 1: true, 2: false, 3: true }
async function recordMcAttempts(uid, sectionKey, problemIndex, correctMap) {
  const section = await readSection(uid, sectionKey);
  const now = Date.now();
  const newAttempts = Object.entries(correctMap).map(([qNum, correct]) => ({
    correct: Boolean(correct), problemIndex, qNum: Number(qNum), timestamp: now,
  }));
  const prevByProblem = section.byProblem ?? {};
  const newResults = Object.values(correctMap).map(Boolean);
  const nextSection = {
    ...section,
    attempts: [...newAttempts, ...(section.attempts ?? [])].slice(0, 500),
    byProblem: {
      ...prevByProblem,
      [problemIndex]: [...newResults, ...(prevByProblem[problemIndex] ?? [])].slice(0, 15),
    },
  };
  await setDoc(sectionRef(uid, sectionKey), nextSection);
  return nextSection.byProblem;
}

// 글쓰기 단어수 + 이전 작성 내용 기록 (Write an Email, Academic Discussion)
async function recordWritingEntry(uid, sectionKey, problemIndex, wordCount, text) {
  const section = await readSection(uid, sectionKey);
  const entry = { wordCount, text, problemIndex, timestamp: Date.now() };
  const prevByProblem = section.byProblem ?? {};
  const nextSection = {
    ...section,
    wordCounts: [entry, ...(section.wordCounts ?? [])].slice(0, 500),
    byProblem: {
      ...prevByProblem,
      // byProblem에 최근 3개 단어수 저장 (목록에서 표시용)
      [problemIndex]: [wordCount, ...(prevByProblem[problemIndex] ?? [])].slice(0, 3),
    },
    // 문제별 마지막 작성 내용 저장
    lastDraft: {
      ...(section.lastDraft ?? {}),
      [problemIndex]: text,
    },
  };
  await setDoc(sectionRef(uid, sectionKey), nextSection);
  return nextSection;
}

async function getAccuracy(uid, sectionKey) {
  const data = await readSection(uid, sectionKey);
  const attempts = data.attempts ?? [];
  const correct = attempts.filter((a) => a.correct).length;
  return {
    attempted: attempts.length, correct,
    percent: attempts.length ? Math.round((correct / attempts.length) * 100) : null,
  };
}

async function getAvgWordCount(uid, sectionKey) {
  const data = await readSection(uid, sectionKey);
  const wordCounts = data.wordCounts ?? [];
  if (!wordCounts.length) return { attempted: 0, avg: null };
  const avg = Math.round(wordCounts.reduce((sum, e) => sum + e.wordCount, 0) / wordCounts.length);
  return { attempted: wordCounts.length, avg };
}

async function getInterviewCount(uid, sectionKey) {
  const data = await readSection(uid, sectionKey);
  return Object.keys(data.byProblem ?? {}).length;
}

async function clearProgress(uid) {
  await Promise.all(PROGRESS_SECTIONS.map((s) => deleteDoc(sectionRef(uid, s.key))));
}

// ── React 훅 ────────────────────────────────────────────────

export function useSectionProgress(sectionKey) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [results, setResults] = useState({});
  const [sectionData, setSectionData] = useState({});

  useEffect(() => {
    if (!uid) return;
    readSection(uid, sectionKey).then((data) => {
      setResults(data.byProblem ?? {});
      setSectionData(data);
    });
  }, [uid, sectionKey]);

  // 단일 정오 기록
  const record = useCallback(async (problemIndex, correct) => {
    if (!uid) return {};
    const updated = await recordSectionAttempt(uid, sectionKey, problemIndex, correct);
    setResults(updated);
    return updated;
  }, [uid, sectionKey]);

  // MC 개별 기록
  const recordMc = useCallback(async (problemIndex, correctMap) => {
    if (!uid) return {};
    const updated = await recordMcAttempts(uid, sectionKey, problemIndex, correctMap);
    setResults(updated);
    return updated;
  }, [uid, sectionKey]);

  // 글쓰기 단어수 + 내용 기록
  const recordWords = useCallback(async (problemIndex, wordCount, text = "") => {
    if (!uid) return {};
    const updated = await recordWritingEntry(uid, sectionKey, problemIndex, wordCount, text);
    setResults(updated.byProblem ?? {});
    setSectionData(updated);
    return updated;
  }, [uid, sectionKey]);

  // 문제별 마지막 작성 내용
  const getLastDraft = useCallback((problemIndex) => {
    return sectionData.lastDraft?.[problemIndex] ?? "";
  }, [sectionData]);

  return { results, record, recordMc, recordWords, getLastDraft };
}

export function useAllProgress() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!uid) return;
    const [completeAcc, dailyAcc, academicAcc, sentenceAcc, emailWc, discussionWc, interviewCount] =
      await Promise.all([
        getAccuracy(uid, "reading_complete"),
        getAccuracy(uid, "reading_daily"),
        getAccuracy(uid, "reading_academic"),
        getAccuracy(uid, "writing_sentence"),
        getAvgWordCount(uid, "writing_email"),
        getAvgWordCount(uid, "writing_discussion"),
        getInterviewCount(uid, "speaking_interview"),
      ]);

    const readingAttempted = completeAcc.attempted + dailyAcc.attempted + academicAcc.attempted;
    const readingCorrect = completeAcc.correct + dailyAcc.correct + academicAcc.correct;
    const readingSummary = {
      attempted: readingAttempted, correct: readingCorrect,
      percent: readingAttempted ? Math.round((readingCorrect / readingAttempted) * 100) : null,
    };

    setData({
      reading: { summary: readingSummary, complete: completeAcc, daily: dailyAcc, academic: academicAcc },
      writing: { sentence: sentenceAcc, email: emailWc, discussion: discussionWc },
      speaking: { interviewCount },
    });
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const clear = useCallback(async () => {
    if (!uid) return;
    await clearProgress(uid);
    await load();
  }, [uid, load]);

  return { data, reload: load, clear };
}