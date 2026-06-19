import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { checkIsAdmin, useAllSubmissions } from "../useSubmissions";
import { useNavigate } from "react-router-dom";

const TOEFL_SCORES = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];

const SECTION_LABELS = {
  writing_email: "Write an Email",
  writing_discussion: "Academic Discussion",
};

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(null); // null=로딩중

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    checkIsAdmin(user).then((result) => {
      if (!result) navigate("/");
      else setIsAdmin(true);
    });
  }, [user, navigate]);

  if (isAdmin === null) {
    return (
      <div className="page-container">
        <p style={{ color: "var(--gray-400)", fontSize: 14 }}>권한 확인 중...</p>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const { submissions, loading, review, reload } = useAllSubmissions();
  const [filter, setFilter] = useState("pending"); // "pending" | "reviewed" | "all"
  const [selected, setSelected] = useState(null); // submission object

  const filtered = submissions.filter((s) => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  return (
    <div className="page-container wide">
      <div className="mymenu-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2>관리자 페이지</h2>
          <p className="mymenu-email">제출된 작문을 검토하고 피드백을 작성하세요.</p>
        </div>
        <button className="btn-secondary" onClick={reload}>새로고침</button>
      </div>

      {/* 필터 탭 */}
      <div className="section-tabs" style={{ marginBottom: 20 }}>
        {[
          { key: "pending", label: `미검토 (${pendingCount})` },
          { key: "reviewed", label: "검토 완료" },
          { key: "all", label: "전체" },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={filter === key ? "section-tab active" : "section-tab"}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--gray-400)", fontSize: 14 }}>불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="placeholder-card">
          <div className="placeholder-icon">📭</div>
          <h2>제출된 작문이 없습니다</h2>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((sub) => (
            <SubmissionRow
              key={sub.id}
              sub={sub}
              onSelect={() => setSelected(sub)}
            />
          ))}
        </div>
      )}

      {selected && (
        <ReviewModal
          sub={selected}
          onClose={() => setSelected(null)}
          onSave={async (data) => {
            await review(selected.id, data);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function SubmissionRow({ sub, onSelect }) {
  const sectionLabel = SECTION_LABELS[sub.sectionKey] ?? sub.sectionKey;
  const date = sub.submittedAt
    ? new Date(sub.submittedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <button
      className="problem-list-item"
      onClick={onSelect}
      style={{ gridTemplateColumns: "auto minmax(0,1fr) auto auto" }}
    >
      <span
        style={{
          width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
          background: sub.status === "pending" ? "#f59e0b" : "var(--green)",
          border: `2px solid ${sub.status === "pending" ? "#fde68a" : "#c8e6c9"}`,
        }}
      />
      <span style={{ minWidth: 0 }}>
        <span className="problem-copy" style={{ display: "block" }}>
          {sub.userEmail}
        </span>
        <span style={{ fontSize: 12, color: "var(--gray-400)", fontWeight: 500 }}>
          {sectionLabel} · {sub.problemLabel} · {sub.wordCount}단어
        </span>
      </span>
      <span style={{ fontSize: 12, color: "var(--gray-400)", flexShrink: 0 }}>{date}</span>
      {sub.status === "reviewed" ? (
        <span style={{
          fontSize: 13, fontWeight: 800, color: "var(--blue)",
          background: "var(--blue-light)", borderRadius: 6, padding: "3px 8px", flexShrink: 0
        }}>
          {sub.score}점
        </span>
      ) : (
        <span style={{
          fontSize: 12, fontWeight: 700, color: "#92400e",
          background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "3px 8px", flexShrink: 0
        }}>
          미검토
        </span>
      )}
    </button>
  );
}

function ReviewModal({ sub, onClose, onSave }) {
  const [score, setScore] = useState(sub.score ?? "");
  const [htmlContent, setHtmlContent] = useState(sub.revised ?? "");
  const [fileName, setFileName] = useState(sub.revised ? "기존 파일 업로드됨" : "");
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const sectionLabel = SECTION_LABELS[sub.sectionKey] ?? sub.sectionKey;

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      alert("HTML 파일만 업로드할 수 있어요.");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setHtmlContent(ev.target.result);
    reader.readAsText(file, "UTF-8");
  }

  async function handleSave() {
    if (score === "") return;
    setSaving(true);
    await onSave({ score: Number(score), revised: htmlContent, comment: "" });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 720, width: "100%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-header">
          <span>✏️ 피드백 작성</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-meta" style={{ marginBottom: 18 }}>
          {sectionLabel} · {sub.problemLabel} · {sub.userEmail}
        </div>

        {/* 제출 글 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-400)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            제출된 글 ({sub.wordCount}단어)
          </div>
          <div style={{
            background: "#f8faff", border: "1px solid var(--gray-200)", borderRadius: 8,
            padding: "14px 16px", fontSize: 14, lineHeight: 1.7,
            color: "var(--gray-800)", whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto"
          }}>
            {sub.draft}
          </div>
        </div>

        {/* TOEFL 점수 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-400)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            TOEFL Writing 점수 (0–6)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TOEFL_SCORES.map((s) => (
              <button
                key={s}
                onClick={() => setScore(s)}
                style={{
                  padding: "6px 12px", borderRadius: 6, border: "1.5px solid",
                  fontWeight: 700, fontSize: 14, cursor: "pointer",
                  borderColor: score === s ? "var(--blue)" : "var(--gray-200)",
                  background: score === s ? "var(--blue)" : "var(--white)",
                  color: score === s ? "white" : "var(--gray-600)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* HTML 파일 업로드 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-400)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            피드백 HTML 파일 업로드 (선택)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 7, border: "1px solid var(--gray-200)",
              background: "var(--white)", color: "var(--gray-600)",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
              📄 파일 선택
              <input
                type="file"
                accept=".html,.htm"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </label>
            {fileName && (
              <span style={{ fontSize: 13, color: "var(--gray-600)" }}>{fileName}</span>
            )}
            {htmlContent && (
              <button
                className="btn-secondary"
                style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 13 }}
                onClick={() => setPreviewing((v) => !v)}
              >
                {previewing ? "미리보기 닫기" : "미리보기"}
              </button>
            )}
          </div>

          {/* 미리보기 iframe */}
          {previewing && htmlContent && (
            <iframe
              srcDoc={htmlContent}
              style={{
                width: "100%", height: 400, marginTop: 12,
                border: "1px solid var(--gray-200)", borderRadius: 8,
              }}
              title="피드백 미리보기"
              sandbox="allow-same-origin"
            />
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={score === "" || saving}
          >
            {saving ? "저장 중..." : "피드백 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}