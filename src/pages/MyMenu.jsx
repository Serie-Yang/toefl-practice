import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteUser, updatePassword } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import {
  PROGRESS_SECTIONS,
  clearProgress,
  getAccuracy,
  getMcAccuracy,
  getAvgWordCount,
  getInterviewCount,
  getGroupAccuracy,
} from "../utils/progress";

export default function MyMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  async function handlePasswordChange(event) {
    event.preventDefault();
    setStatus("");
    setError("");
    if (newPassword.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    try {
      await updatePassword(user, newPassword);
      setNewPassword("");
      setStatus("비밀번호가 변경되었습니다.");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    }
  }

  function handleResetProgress() {
    const confirmed = window.confirm("모든 학습 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.");
    if (!confirmed) return;
    clearProgress();
    setRefreshKey((k) => k + 1);
    setStatus("학습 기록이 모두 삭제되었습니다.");
    setError("");
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm("회원 탈퇴를 진행할까요? 계정과 학습 기록이 삭제됩니다.");
    if (!confirmed) return;
    setStatus("");
    setError("");
    try {
      clearProgress();
      await deleteUser(user);
      navigate("/login");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    }
  }

  return (
    <div className="page-container">
      <div className="mymenu-header">
        <h2>My Menu</h2>
        <p className="mymenu-email">{user?.email}</p>
      </div>

      <section className="account-card">
        <div className="account-card-header">
          <div>
            <span className="account-eyebrow">내 정보</span>
            <h3>계정 관리</h3>
          </div>
        </div>

        <form className="account-form" onSubmit={handlePasswordChange}>
          <div className="form-group">
            <label htmlFor="new-password">비밀번호 바꾸기</label>
            <div className="inline-form-row">
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호"
              />
              <button type="submit" className="btn-primary">변경</button>
            </div>
          </div>
        </form>

        <div className="account-actions">
          <button type="button" className="btn-secondary" onClick={handleResetProgress}>기록 전체 삭제</button>
          <button type="button" className="btn-danger" onClick={handleDeleteAccount}>회원 탈퇴</button>
        </div>

        {status && <div className="status-message">{status}</div>}
        {error && <div className="error-message">{error}</div>}
      </section>

      <div className="mymenu-grid" key={refreshKey}>
        <ReadingProgress />
        <WritingProgress />
        <SpeakingProgress />
      </div>
    </div>
  );
}

/* ── READING ── */
function ReadingProgress() {
  const complete = getAccuracy("reading_complete");
  const daily = getMcAccuracy("reading_daily");
  const academic = getMcAccuracy("reading_academic");

  const allAttempted = complete.attempted + daily.attempted + academic.attempted;
  const allCorrect = complete.correct + daily.correct + academic.correct;
  const groupPercent = allAttempted ? Math.round((allCorrect / allAttempted) * 100) : null;
  const groupSummary = { attempted: allAttempted, correct: allCorrect, percent: groupPercent };

  return (
    <div className="progress-card">
      <div className="progress-card-header">
        <div>
          <h3>Reading</h3>
        </div>
        <AccuracyBadge accuracy={groupSummary} large />
      </div>
      <div className="progress-subsections">
        <SubsectionAccuracy label="Complete the Words" accuracy={complete} />
        <SubsectionAccuracy label="Read in Daily Life" accuracy={daily} />
        <SubsectionAccuracy label="Read an Academic Passage" accuracy={academic} />
      </div>
    </div>
  );
}

/* ── WRITING ── */
function WritingProgress() {
  const sentence = getAccuracy("writing_sentence");
  const email = getAvgWordCount("writing_email");
  const discussion = getAvgWordCount("writing_discussion");

  return (
    <div className="progress-card">
      <div className="progress-card-header">
        <div>
          <h3>Writing</h3>
        </div>
        <AccuracyBadge accuracy={sentence} large />
      </div>
      <div className="progress-subsections">
        <SubsectionAccuracy label="Build a Sentence" accuracy={sentence} />
        <SubsectionWordCount label="Write an Email" stat={email} targetWords={130} />
        <SubsectionWordCount label="Academic Discussion" stat={discussion} targetWords={120} />
      </div>
    </div>
  );
}

/* ── SPEAKING ── */
function SpeakingProgress() {
  const count = getInterviewCount("speaking_interview");

  return (
    <div className="progress-card">
      <div className="progress-card-header">
        <div>
          <h3>Speaking</h3>
        </div>
        <div className="accuracy-badge large">
          <strong style={{ color: "var(--blue)", fontSize: 19 }}>{count}</strong>
          <span>문제</span>
        </div>
      </div>
      <div className="progress-subsections">
        <div className="progress-subsection">
          <span className="subsection-name">Take an Interview</span>
          <div className="accuracy-row">
            <div style={{ flex: 1 }} />
            <div className="accuracy-badge">
              <strong>{count}문제</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── SHARED SUB-COMPONENTS ── */
function SubsectionAccuracy({ label, accuracy }) {
  const percent = accuracy.percent ?? 0;
  return (
    <div className="progress-subsection">
      <span className="subsection-name">{label}</span>
      <div className="accuracy-row">
        <div className="accuracy-track" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
        <AccuracyBadge accuracy={accuracy} />
      </div>
    </div>
  );
}

function SubsectionWordCount({ label, stat, targetWords }) {
  const avg = stat.avg ?? 0;
  const barPercent = Math.min(Math.round((avg / targetWords) * 100), 100);

  return (
    <div className="progress-subsection">
      <span className="subsection-name">{label}</span>
      <div className="accuracy-row">
        <div className="accuracy-track" aria-hidden="true">
          <span style={{ width: `${barPercent}%` }} />
        </div>
        <div className="accuracy-badge">
          <strong>{stat.avg !== null ? `${stat.avg}단어` : "--"}</strong>
          <span>/{stat.attempted}문제</span>
        </div>
      </div>
    </div>
  );
}

function AccuracyBadge({ accuracy, large = false }) {
  const label = accuracy.percent === null ? "--" : `${accuracy.percent}%`;
  return (
    <div className={large ? "accuracy-badge large" : "accuracy-badge"}>
      <strong>{label}</strong>
      <span>{accuracy.correct}/{accuracy.attempted}</span>
    </div>
  );
}

function getAuthErrorMessage(err) {
  if (err?.code === "auth/requires-recent-login") return "보안을 위해 다시 로그인한 뒤 시도해주세요.";
  if (err?.code === "auth/weak-password") return "비밀번호는 6자 이상이어야 합니다.";
  return "처리 중 오류가 발생했습니다. 다시 시도해주세요.";
}