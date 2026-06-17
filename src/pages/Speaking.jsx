import { useEffect, useMemo, useState } from "react";
import emailjs from "@emailjs/browser";
import { useSheetData } from "../hooks/useSheetData";
import { useSectionProgress } from "../useProgress";
import { useAuth } from "../context/AuthContext";

const SECTIONS = [
  { id: "interview", label: "Take an Interview" },
];

const SPEAKING_INFO = {
  interview: {
    title: "4문항",
    instruction: "Participate in a simulated conversation with a prerecorded interviewer.",
    description: "다양한 상황에 맞게 인터뷰 질문이 출제됩니다. 각 인터뷰는 4개의 질문으로 구성되어 있으며, 각 질문마다 45초의 답변 시간이 주어집니다. 첫 질문은 개인적인 경험이나 의견을 묻는 질문으로 시작하여, 점차 넓은 범위의 주제에 대한 질문으로 이어집니다.",
    tips: [
      "첫 5초 안에 질문에 직접 답하세요. 결론을 먼저 말한 뒤 이유를 설명하는 것이 좋습니다.",
      "답변은 '의견 → 이유 → 예시' 구조로 말하면 45초를 자연스럽게 채울 수 있습니다.",
      "실제 시험은 녹음된 인터뷰어와 진행하므로, 화면에 질문이 표시되는 현재 연습보다 어렵습니다. 질문을 들으며 할말을 생각하는 연습도 필요합니다.",
    ],
  },
};

export default function Speaking() {
  const [activeSection, setActiveSection] = useState("interview");

  return (
    <div className="page-container wide">
      <div className="section-tabs">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={activeSection === s.id ? "section-tab active" : "section-tab"}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="question-area">
        {activeSection === "interview" && <TakeAnInterview />}
      </div>
    </div>
  );
}

function TakeAnInterview() {
  const { data, loading, error } = useSheetData("interview");
  const { results, record } = useSectionProgress("speaking_interview");
  const [idx, setIdx] = useState(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [showSample, setShowSample] = useState(false);
  const [shownSamples, setShownSamples] = useState(new Set());
  const [timerStartedAt, setTimerStartedAt] = useState(null);
  const [timerBaseSeconds, setTimerBaseSeconds] = useState(45);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const { user } = useAuth();
  const now = useCurrentTime(timerRunning);
  const info = SPEAKING_INFO.interview;
  const speechTimerSeconds = getSpeechTimerSeconds(timerStartedAt, timerBaseSeconds, timerRunning, now);

  const row = idx === null ? null : data[idx];
  const questions = useMemo(() => {
    if (!row) return [];
    return [1, 2, 3, 4]
      .map((n) => ({ n, question: row[`q${n}`], sample: row[`q${n}_sample`] }))
      .filter((item) => item.question);
  }, [row]);

  if (loading) return <LoadingCard />;
  if (error) return <ErrorCard message={error} />;
  if (!data.length) return <EmptyCard />;
  if (idx === null) {
    return (
      <SectionHome
        info={info}
        items={data}
        results={results}
        onSelect={(i) => resetQuestion(i)}
      />
    );
  }

  const current = questions[questionIdx] ?? questions[0];

  function resetQuestion(nextInterview = idx, nextQuestion = 0) {
    setIdx(nextInterview);
    setQuestionIdx(nextQuestion);
    setShowSample(false);
    setShownSamples(new Set());
    setShowReport(false);
    resetSpeechTimer();
  }

  async function moveQuestion(direction) {
    const next = questionIdx + direction;
    if (next >= 0 && next < questions.length) {
      if (next === questions.length - 1) {
        await record(idx, true);
      }
      resetQuestion(idx, next);
    }
  }

  function handleShowSample() {
    const next = new Set(shownSamples).add(questionIdx);
    setShownSamples(next);
    setShowSample(true);
  }

  function startSpeechTimer() {
    if (speechTimerSeconds === 0) return;
    setTimerStartedAt(Date.now());
    setTimerBaseSeconds(speechTimerSeconds);
    setTimerRunning(true);
  }

  function resetSpeechTimer() {
    setTimerStartedAt(null);
    setTimerBaseSeconds(45);
    setTimerRunning(false);
  }

  return (
    <div className="question-card speaking-card">
      <QuestionHeader
        badge={getQuestionBadge(idx)}
        instruction={info.instruction}
        onBack={() => setIdx(null)}
        onReport={() => setShowReport(true)}
      />

      {row.topic && <TextBlock className="prompt-text-block" text={row.topic} />}

      <div className="speaking-layout">
        <section className="speaking-prompt">
          <span className="q-badge light">Question {current.n}</span>
          <p>{current.question}</p>
        </section>

        <section className="speaking-timer-panel">
          <span className="timer-label">Speaking timer</span>
          <strong>{formatTime(speechTimerSeconds)}</strong>
          <div className="timer-actions">
            <button
              className="btn-primary"
              onClick={startSpeechTimer}
              disabled={timerRunning || speechTimerSeconds === 0}
            >
              {speechTimerSeconds === 45 ? "Start 45 sec" : "Resume"}
            </button>
            <button className="btn-secondary" onClick={resetSpeechTimer}>Reset</button>
          </div>
        </section>
      </div>

      {showSample && current.sample && (
        <div className="sample-answer">
          <strong>Sample response</strong>
          <TextBlock text={current.sample} />
        </div>
      )}

      <div className="card-actions">
        <button className="btn-secondary" onClick={() => moveQuestion(-1)} disabled={questionIdx === 0}>Prev</button>
        <div className="action-cluster">
          {!showSample && <button className="btn-primary" onClick={handleShowSample}>Show sample</button>}
        </div>
        {questionIdx < questions.length - 1 ? (
          <button className="btn-secondary" onClick={() => moveQuestion(1)}>Next</button>
        ) : (
          <button
            className="btn-secondary"
            onClick={() => resetQuestion(Math.min(idx + 1, data.length - 1))}
            disabled={idx === data.length - 1}
          >
            Next interview
          </button>
        )}
      </div>

      {showReport && (
        <ReportModal
          section="Speaking - Take an Interview"
          problemNumber={idx + 1}
          problemLabel={getProblemLabel(row, idx)}
          userEmail={user?.email ?? ""}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

function SectionHome({ info, items, results, onSelect }) {
  return (
    <div className="section-home">
      <div className="section-intro">
        <span className="q-badge">{info.title}</span>
        <h2>{info.instruction}</h2>
        <p>{info.description}</p>
        {info.tips && (
          <div className="tip-box">
            {info.tips.map((tip, i) => (
              <div key={i} className="tip-item">
                <span className="tip-icon">💡</span>
                <span><strong>Tip</strong> {tip}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="problem-list">
        {items.map((row, itemIdx) => (
          <button key={row.id || itemIdx} className="problem-list-item" onClick={() => onSelect(itemIdx)}>
            <span className="problem-index">{itemIdx + 1}</span>
            <span className="problem-copy">{getProblemLabel(row, itemIdx)}</span>
            <ResultDots attempts={results[itemIdx]} />
          </button>
        ))}
      </div>
    </div>
  );
}

function QuestionHeader({ badge, instruction, onBack, onReport }) {
  return (
    <div className="question-meta">
      <div>
        <span className="q-badge">{badge}</span>
        <h2 className="question-instruction">{instruction}</h2>
      </div>
      <div className="question-tools">
        <button className="btn-secondary compact" onClick={onReport}>🚨 Report</button>
        <button className="btn-secondary compact" onClick={onBack}>List</button>
      </div>
    </div>
  );
}

function ResultDots({ attempts = [] }) {
  // Speaking은 완료 여부만 표시 (점 1개)
  const done = attempts[0] === true;
  return (
    <span className="result-dots" aria-label="Recent results">
      <span className={`result-dot ${done ? "correct" : ""}`} />
    </span>
  );
}

function ReportModal({ section, problemNumber, problemLabel, userEmail, onClose }) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("idle");

  async function handleSubmit() {
    if (!reason.trim()) return;
    setStatus("sending");
    try {
      emailjs.init("yTTgUnSO_K7drzPam"); 
      await emailjs.send("service_rqzbtkr", "template_lqa08fq", {
        section,
        problem_number: problemNumber,
        problem_label: problemLabel,
        user_email: userEmail || "비로그인 사용자",
        reason: reason.trim(),
        timestamp: new Date().toLocaleString("ko-KR"),
      });
      setStatus("done");
    } catch (err) {
      console.error("EmailJS error:", err);
      setStatus("error");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>🚨 문제 신고</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-meta">{section} · {problemNumber}번 문제</div>

        {status === "done" ? (
          <div className="modal-success">
            신고가 접수되었습니다. 빠르게 확인할게요!
            <br />
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={onClose}>닫기</button>
          </div>
        ) : (
          <>
            <textarea
              className="writing-textarea compact"
              placeholder="오류 내용을 간단히 설명해주세요. (예: 정답이 틀렸어요, 지문에 오타가 있어요)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {status === "error" && (
              <div className="error-message" style={{ marginTop: 8 }}>전송에 실패했습니다. 다시 시도해주세요.</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={onClose}>취소</button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={!reason.trim() || status === "sending"}
              >
                {status === "sending" ? "전송 중..." : "신고하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TextBlock({ className, text }) {
  return (
    <div className={className}>
      {text.split(/\n/).map((line, i) => (
        <p key={i}>{line || "\u00a0"}</p>
      ))}
    </div>
  );
}

function useCurrentTime(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function getSpeechTimerSeconds(startedAt, baseSeconds, running, now) {
  if (!running || startedAt === null) return baseSeconds;
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  return Math.max(baseSeconds - elapsed, 0);
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getProblemLabel(row, itemIdx) {
  return row.problem?.trim() || `Problem ${itemIdx + 1}`;
}

function getQuestionBadge(itemIdx) {
  return String(itemIdx + 1);
}

function LoadingCard() {
  return (
    <div className="placeholder-card">
      <div className="placeholder-icon">...</div>
      <h2>문제를 불러오는 중...</h2>
    </div>
  );
}

function ErrorCard({ message }) {
  return (
    <div className="placeholder-card">
      <div className="placeholder-icon">!</div>
      <h2>불러오기 실패</h2>
      <p className="placeholder-sub">{message}</p>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="placeholder-card">
      <div className="placeholder-icon">-</div>
      <h2>문제가 없습니다</h2>
      <p className="placeholder-sub">Google Sheets에 데이터를 입력해주세요.</p>
    </div>
  );
}