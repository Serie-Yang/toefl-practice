import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext";
import { db } from "./firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

// ── Firestore 경로 헬퍼 ──────────────────────────────────────
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
  return snap.exists() ? snap.data() : { attempts: [], byProblem: {}, byProblemMc: {}, byProblemCloze: {}, byProblemWriting: {} };
}

async function getSectionResults(uid, sectionKey) {
  const data = await readSection(uid, sectionKey);
  return data.byProblem ?? {};
}

async function recordSectionAttempt(uid, sectionKey, problemIndex, correct) {
  const section = await readSection(uid, sectionKey);
  const result = Boolean(correct);
  const attempt = { correct: result, problemIndex, timestamp: Date.now() };

  const nextSection = {
    ...section,
    attempts: [attempt, ...(section.attempts ?? [])].slice(0, 200),
    byProblem: {
      ...(section.byProblem ?? {}),
      [problemIndex]: [
        result,
        ...((section.byProblem ?? {})[problemIndex] ?? []),
      ].slice(0, 3),
    },
  };

  await setDoc(sectionRef(uid, sectionKey), nextSection);
  return nextSection.byProblem;
}

// typedValues: ["ght", "by", "ly", ...] — 빈칸 순서대로
// answers: ["ght", "by", "ly", ...] — 정답 배열
async function recordClozeAttempt(uid, sectionKey, problemIndex, typedValues, answers) {
  const section = await readSection(uid, sectionKey);

  const isAllCorrect = typedValues.every(
    (v, i) => normalizeStr(v) === normalizeStr(answers[i] ?? "")
  );
  const attempt = { correct: isAllCorrect, problemIndex, timestamp: Date.now() };
  const clozeEntry = { typed: typedValues, timestamp: Date.now() };

  const prevClozeHistory = (section.byProblemCloze ?? {})[problemIndex] ?? [];

  const nextSection = {
    attempts: [attempt, ...(section.attempts ?? [])].slice(0, 200),
    byProblem: {
      ...(section.byProblem ?? {}),
      [problemIndex]: [
        isAllCorrect,
        ...((section.byProblem ?? {})[problemIndex] ?? []),
      ].slice(0, 3),
    },
    byProblemMc: section.byProblemMc ?? {},
    byProblemCloze: {
      ...(section.byProblemCloze ?? {}),
      [problemIndex]: [clozeEntry, ...prevClozeHistory],
    },
  };

  await setDoc(sectionRef(uid, sectionKey), nextSection);
  return { byProblem: nextSection.byProblem, byProblemCloze: nextSection.byProblemCloze };
}

function normalizeStr(value = "") {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
async function recordMcAttempt(uid, sectionKey, problemIndex, selectedMap, answerMap) {
  const section = await readSection(uid, sectionKey);

  const isAllCorrect = Object.keys(answerMap).every(
    (n) => selectedMap[n] === answerMap[n]
  );
  const correctMap = {};
  Object.keys(answerMap).forEach((n) => {
    correctMap[n] = selectedMap[n] === answerMap[n];
  });

  const attempt = { correct: isAllCorrect, problemIndex, timestamp: Date.now() };
  const mcEntry = { selected: selectedMap, correctMap, timestamp: Date.now() };

  const prevMcHistory = (section.byProblemMc ?? {})[problemIndex] ?? [];

  const nextSection = {
    attempts: [attempt, ...(section.attempts ?? [])].slice(0, 200),
    byProblem: {
      ...(section.byProblem ?? {}),
      [problemIndex]: [
        isAllCorrect,
        ...((section.byProblem ?? {})[problemIndex] ?? []),
      ].slice(0, 3),
    },
    byProblemMc: {
      ...(section.byProblemMc ?? {}),
      [problemIndex]: [mcEntry, ...prevMcHistory], // 전부 보관
    },
  };

  await setDoc(sectionRef(uid, sectionKey), nextSection);
  return { byProblem: nextSection.byProblem, byProblemMc: nextSection.byProblemMc };
}

async function recordWritingAttempt(uid, sectionKey, problemIndex, wordCount, draft, elapsedSeconds) {
  const section = await readSection(uid, sectionKey);
  const entry = { wordCount, draft, elapsedSeconds: elapsedSeconds ?? null, timestamp: Date.now() };
  const prevHistory = (section.byProblemWriting ?? {})[problemIndex] ?? [];

  const nextSection = {
    ...section,
    byProblem: {
      ...(section.byProblem ?? {}),
      [problemIndex]: [
        true,
        ...((section.byProblem ?? {})[problemIndex] ?? []),
      ].slice(0, 3),
    },
    byProblemWriting: {
      ...(section.byProblemWriting ?? {}),
      [problemIndex]: [entry, ...prevHistory],
    },
  };

  await setDoc(sectionRef(uid, sectionKey), nextSection);
  return { byProblem: nextSection.byProblem, byProblemWriting: nextSection.byProblemWriting };
}

async function getWritingStats(uid, sectionKey) {
  const data = await readSection(uid, sectionKey);
  const byProblemWriting = data.byProblemWriting ?? {};
  const attempted = Object.keys(byProblemWriting).length;
  const allEntries = Object.values(byProblemWriting).flatMap((entries) => entries);
  const avgWords = allEntries.length
    ? Math.round(allEntries.reduce((sum, e) => sum + (e.wordCount ?? 0), 0) / allEntries.length)
    : null;
  return { attempted, avgWords };
}

async function getRecentAccuracy(uid, sectionKey, limit = 20) {
  const data = await readSection(uid, sectionKey);
  const recent = (data.attempts ?? []).slice(0, limit);
  const correct = recent.filter((a) => a.correct).length;
  return {
    attempted: recent.length,
    correct,
    percent: recent.length ? Math.round((correct / recent.length) * 100) : null,
  };
}

async function getGroupRecentAccuracy(uid, group, limit = 20) {
  const keys = PROGRESS_SECTIONS.filter((s) => s.group === group).map((s) => s.key);

  const allAttempts = (await Promise.all(keys.map((key) => readSection(uid, key))))
    .flatMap((data) => data.attempts ?? [])
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, limit);

  const correct = allAttempts.filter((a) => a.correct).length;
  return {
    attempted: allAttempts.length,
    correct,
    percent: allAttempts.length ? Math.round((correct / allAttempts.length) * 100) : null,
  };
}

async function clearProgress(uid) {
  await Promise.all(
    PROGRESS_SECTIONS.map((s) => deleteDoc(sectionRef(uid, s.key)))
  );
}

// ── React 훅 ────────────────────────────────────────────────

/**
 * 섹션 결과 로드 + 기록 훅
 * Reading / Writing / Speaking 컴포넌트에서 사용
 */
export function useSectionProgress(sectionKey) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [results, setResults] = useState({});
  const [mcHistory, setMcHistory] = useState({});
  const [clozeHistory, setClozeHistory] = useState({});
  const [writingHistory, setWritingHistory] = useState({});

  useEffect(() => {
    if (!uid) return;
    readSection(uid, sectionKey).then((data) => {
      setResults(data.byProblem ?? {});
      setMcHistory(data.byProblemMc ?? {});
      setClozeHistory(data.byProblemCloze ?? {});
      setWritingHistory(data.byProblemWriting ?? {});
    });
  }, [uid, sectionKey]);

  const record = useCallback(
    async (problemIndex, correct) => {
      if (!uid) return {};
      const updated = await recordSectionAttempt(uid, sectionKey, problemIndex, correct);
      setResults(updated);
      return updated;
    },
    [uid, sectionKey]
  );

  const recordMc = useCallback(
    async (problemIndex, selectedMap, answerMap) => {
      if (!uid) return {};
      const updated = await recordMcAttempt(uid, sectionKey, problemIndex, selectedMap, answerMap);
      setResults(updated.byProblem);
      setMcHistory(updated.byProblemMc);
      return updated;
    },
    [uid, sectionKey]
  );

  const recordCloze = useCallback(
    async (problemIndex, typedValues, answers) => {
      if (!uid) return {};
      const updated = await recordClozeAttempt(uid, sectionKey, problemIndex, typedValues, answers);
      setResults(updated.byProblem);
      setClozeHistory(updated.byProblemCloze);
      return updated;
    },
    [uid, sectionKey]
  );

  const recordWords = useCallback(
    async (problemIndex, wordCount, draft, elapsedSeconds) => {
      if (!uid) return {};
      const updated = await recordWritingAttempt(uid, sectionKey, problemIndex, wordCount, draft, elapsedSeconds);
      setResults(updated.byProblem);
      setWritingHistory(updated.byProblemWriting);
      return updated;
    },
    [uid, sectionKey]
  );

  const getLastDraft = useCallback(
    (problemIndex) => writingHistory[problemIndex]?.[0]?.draft ?? "",
    [writingHistory]
  );

  return { results, record, recordMc, mcHistory, recordCloze, clozeHistory, recordWords, getLastDraft, writingHistory };
}

/**
 * MyMenu용: 전체 섹션 정확도 로드
 */
export function useAllProgress() {
  const { user } = useAuth();
  const uid = user?.uid;

  const [data, setData] = useState(null); // null = 로딩 중

  const load = useCallback(async () => {
    if (!uid) return;
    const groups = ["Reading", "Writing", "Speaking"];

    const [groupAccuracies, sectionAccuracies, emailStats, discussionStats] = await Promise.all([
      Promise.all(groups.map((g) => getGroupRecentAccuracy(uid, g))),
      Promise.all(PROGRESS_SECTIONS.map((s) => getRecentAccuracy(uid, s.key))),
      getWritingStats(uid, "writing_email"),
      getWritingStats(uid, "writing_discussion"),
    ]);

    const writingStatsMap = {
      writing_email: emailStats,
      writing_discussion: discussionStats,
    };

    const result = groups.map((group, gi) => ({
      title: group,
      summary: groupAccuracies[gi],
      subsections: PROGRESS_SECTIONS
        .filter((s) => s.group === group)
        .map((s) => ({
          ...s,
          accuracy: sectionAccuracies[PROGRESS_SECTIONS.indexOf(s)],
          writingStats: writingStatsMap[s.key] ?? null,
        })),
    }));

    setData(result);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const clear = useCallback(async () => {
    if (!uid) return;
    await clearProgress(uid);
    await load();
  }, [uid, load]);

  return { data, reload: load, clear };
}