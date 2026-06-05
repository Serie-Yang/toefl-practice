import { useEffect, useMemo, useState } from "react";
import { useSheetData } from "../hooks/useSheetData";
import { getSectionResults, recordSectionAttempt } from "../utils/progress";

const SECTIONS = [
  { id: "interview", label: "Take an Interview" },
];

const SPEAKING_INFO = {
  interview: {
    title: "4문항",
    instruction: "Participate in a simulated conversation with a prerecorded interviewer.",
    description: "다양한 상황에 맞게 인터뷰 질문이 출제됩니다. 각 인터뷰는 4개의 질문으로 구성되어 있으며, 각 질문마다 45초의 답변 시간이 주어집니다. 첫 질문은 개인적인 경험이나 의견을 묻는 질문으로 시작하여, 점차 넓은 범위의 주제에 대한 질문으로 이어집니다.",
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
  const sectionKey = "speaking_interview";
  const [idx, setIdx] = useState(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [showSample, setShowSample] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState(null);
  const [timerBaseSeconds, setTimerBaseSeconds] = useState(45);
  const [timerRunning, setTimerRunning] = useState(false);
  const [results, setResults] = useState(() => getSectionResults(sectionKey));
  const now = useCurrentTime(timerRunning);
  const info = SPEAKING_INFO.interview;
  const speechTimerSeconds = getSpeechTimerSeconds(timerStartedAt, timerBaseSeconds, timerRunning, now);

  const row = idx === null ? null : data[idx];
  const questions = useMemo(() => {
    if (!row) return [];
    return [1, 2, 3, 4]
      .map((n) => ({
        n,
        question: row[`q${n}`],
        sample: row[`q${n}_sample`],
      }))
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
        onSelect={(itemIdx) => resetQuestion(itemIdx)}
      />
    );
  }

  const current = questions[questionIdx] ?? questions[0];

  function resetQuestion(nextInterview = idx, nextQuestion = 0) {
    setIdx(nextInterview);
    setQuestionIdx(nextQuestion);
    setShowSample(false);
    resetSpeechTimer();
  }

  function moveQuestion(direction) {
    const next = questionIdx + direction;
    if (next >= 0 && next < questions.length) {
      resetQuestion(idx, next);
    }
  }

  function handleShowSample() {
    setResults(recordSectionAttempt(sectionKey, idx, true));
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
            <button className="btn-primary" onClick={startSpeechTimer} disabled={timerRunning || speechTimerSeconds === 0}>
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

function QuestionHeader({ badge, instruction, onBack }) {
  return (
    <div className="question-meta">
      <div>
        <span className="q-badge">{badge}</span>
        <h2 className="question-instruction">{instruction}</h2>
      </div>
      <div className="question-tools">
        <button className="btn-secondary compact" onClick={onBack}>List</button>
      </div>
    </div>
  );
}

function ResultDots({ attempts = [] }) {
  const dots = Array.from({ length: 3 }, (_, dotIdx) => attempts[dotIdx]);
  return (
    <span className="result-dots" aria-label="Recent results">
      {dots.map((result, dotIdx) => (
        <span
          key={dotIdx}
          className={`result-dot ${result === true ? "correct" : result === false ? "incorrect" : ""}`}
        />
      ))}
    </span>
  );
}

function TextBlock({ className, text }) {
  return (
    <div className={className}>
      {text.split(/\n/).map((line, lineIdx) => (
        <p key={lineIdx}>{line || "\u00a0"}</p>
      ))}
    </div>
  );
}

function useCurrentTime(active) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return undefined;

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [active]);

  return now;
}

function getSpeechTimerSeconds(startedAt, baseSeconds, running, now) {
  if (!running || startedAt === null) return baseSeconds;

  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return Math.max(baseSeconds - elapsedSeconds, 0);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
