import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  getDoc,
} from "firebase/firestore";

// ── Firestore 구조 ──────────────────────────────────────────
// submissions/{autoId}
//   uid, userEmail, sectionKey, problemIndex, problemLabel
//   draft (제출 글), wordCount, submittedAt
//   status: "pending" | "reviewed"
//   score (null or 0~6, 0.5 단위), revised, comment, reviewedAt

// admins/{email} — 문서가 존재하면 관리자
// ──────────────────────────────────────────────────────────

export async function checkIsAdmin(user) {
  if (!user?.email) return false;
  // Firestore 이메일 doc ID에는 점(.) 대신 쓸 수 없으므로 그대로 사용
  // (Firebase doc ID는 점 허용)
  const ref = doc(db, "admins", user.email);
  const snap = await getDoc(ref);
  return snap.exists();
}

// ── 유저용 훅: 특정 섹션의 내 제출 목록 ──────────────────
export function useMySubmissions(sectionKey) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [submissions, setSubmissions] = useState({}); // { problemIndex: [submission...] }
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "submissions"),
        where("uid", "==", uid),
        where("sectionKey", "==", sectionKey),
        orderBy("submittedAt", "desc")
      );
      const snap = await getDocs(q);
      const byProblem = {};
      snap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        const pi = data.problemIndex;
        if (!byProblem[pi]) byProblem[pi] = [];
        byProblem[pi].push(data);
      });
      setSubmissions(byProblem);
    } finally {
      setLoading(false);
    }
  }, [uid, sectionKey]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(
    async (problemIndex, problemLabel, draft, wordCount) => {
      if (!uid) return;
      await addDoc(collection(db, "submissions"), {
        uid,
        userEmail: user.email,
        sectionKey,
        problemIndex,
        problemLabel,
        draft,
        wordCount,
        submittedAt: Date.now(),
        status: "pending",
        score: null,
        revised: "",
        comment: "",
        reviewedAt: null,
      });
      await load();
    },
    [uid, user, sectionKey, load]
  );

  return { submissions, loading, submit, reload: load };
}

// ── 관리자용 훅: 전체 제출 목록 ──────────────────────────
export function useAllSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "submissions"),
        orderBy("submittedAt", "desc")
      );
      const snap = await getDocs(q);
      setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const review = useCallback(async (submissionId, { score, revised, comment }) => {
    const ref = doc(db, "submissions", submissionId);
    await updateDoc(ref, {
      score,
      revised: revised ?? "",
      comment: comment ?? "",
      status: "reviewed",
      reviewedAt: Date.now(),
    });
    await load();
  }, [load]);

  return { submissions, loading, review, reload: load };
}