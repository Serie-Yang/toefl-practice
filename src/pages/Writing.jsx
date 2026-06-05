import { useEffect, useMemo, useState } from "react";
import { useSheetData } from "../hooks/useSheetData";
import { getSectionResults, recordSectionAttempt, recordWordCount } from "../utils/progress";

const SECTIONS = [
  { id: "sentence", label: "Build a Sentence" },
  { id: "email", label: "Write an Email" },
  { id: "discussion", label: "Academic Discussion" },
];

const WRITING_INFO = {
  sentence: {
    title: "10문항",
    instruction: "Drag and drop the word blocks into the correct order to form a complete sentence.",
    description: "주어진 단어 또는 구(phrase) 블록을 올바른 순서로 배열하여 문법적으로 완성된 문장을 만드세요.",
  },
  email: {
    title: "1문항",
    instruction: "Write a purposeful email responding to the given scenario.",
    description: "학교 또는 일상 상황이 주어지며, 추천 요청·초대·문제 해결 제안 등 특정 목적에 맞는 이메일을 작성합니다. 명확하고 자연스러운 영어로 목적을 달성하는 글쓰기 능력을 평가합니다. 제한 시간은 7분입니다.",
  },
  discussion: {
    title: "1문항",
    instruction: "State and support your opinion in an online academic discussion forum.",
    description: "교수의 질문과 다른 학생들의 의견이 포함된 온라인 토론 게시판 형식입니다. 주어진 주제에 대한 자신의 의견을 논리적인 근거와 함께 작성하세요. 제한 시간은 10분입니다.",
  },
};

export default function Writing() {
  const [activeSection, setActiveSection] = useState("sentence");

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
        {activeSection === "sentence" && <BuildASentence />}
        {activeSection === "email" && <WriteAnEmail />}
        {activeSection === "discussion" && <AcademicDiscussion />}
      </div>
    </div>
  );
}

function BuildASentence() {
  const { data, loading, error } = useSheetData("build_sentence");
  const sectionKey = "writing_sentence";
  const [idx, setIdx] = useState(null);
  const [picked, setPicked] = useState([]);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState(() => getSectionResults(sectionKey));
  const info = WRITING_INFO.sentence;

  const row = idx === null ? null : data[idx];
  const words = useMemo(() => splitWords(row?.words), [row]);
  const answer = row?.answer?.trim() ?? "";
  const userAnswer = picked.map((item) => item.word).join(" ");
  const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(answer);

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

  function addWord(word, sourceIndex) {
    if (checked) return;
    setPicked((current) => [...current, { word, sourceIndex, id: `${sourceIndex}-${current.length}` }]);
  }

  function removeWord(id) {
    if (checked) return;
    setPicked((current) => current.filter((item) => item.id !== id));
  }

  function resetQuestion(nextIdx = idx) {
    setIdx(nextIdx);
    setPicked([]);
    setChecked(false);
  }

  function handleCheck() {
    setResults(recordSectionAttempt(sectionKey, idx, isCorrect));
    setChecked(true);
  }

  return (
    <div className="question-card writing-card">
      <QuestionHeader
        badge={getQuestionBadge(idx)}
        instruction={info.instruction}
        onBack={() => setIdx(null)}
      />
      {row.prompt && <TextBlock className="task-note" text={row.prompt} />}

      <div className={`sentence-builder ${checked ? (isCorrect ? "correct" : "incorrect") : ""}`}>
        {picked.length ? (
          picked.map((item) => (
            <button key={item.id} className="answer-chip" onClick={() => removeWord(item.id)}>
              {item.word}
            </button>
          ))
        ) : (
          <span className="builder-placeholder">Choose words below to build the sentence.</span>
        )}
      </div>

      <div className="word-bank">
        {words.map((word, sourceIndex) => (
          <button
            key={`${word}-${sourceIndex}`}
            className="word-chip"
            onClick={() => addWord(word, sourceIndex)}
            disabled={checked}
          >
            {word}
          </button>
        ))}
      </div>

      {checked && (
        <div className={isCorrect ? "feedback-box correct" : "feedback-box incorrect"}>
          <strong>{isCorrect ? "Correct" : "Model answer"}</strong>
          <p>{answer}</p>
        </div>
      )}

      <QuestionActions
        idx={idx}
        total={data.length}
        checked={checked}
        onPrev={() => resetQuestion(Math.max(idx - 1, 0))}
        onCheck={handleCheck}
        onNext={() => resetQuestion(Math.min(idx + 1, data.length - 1))}
        extraAction={<button className="btn-secondary" onClick={() => resetQuestion()}>Reset</button>}
      />
    </div>
  );
}

function WriteAnEmail() {
  const { data, loading, error } = useSheetData("email");
  return (
    <LongWritingTask
      sectionId="email"
      data={data}
      loading={loading}
      error={error}
      badge="Write an Email"
      minWords={80}
      textareaLabel="Email response"
    />
  );
}

function AcademicDiscussion() {
  const { data, loading, error } = useSheetData("discussion");
  return (
    <LongWritingTask
      sectionId="discussion"
      data={data}
      loading={loading}
      error={error}
      badge="Academic Discussion"
      minWords={100}
      textareaLabel="Discussion post"
      showDiscussion
    />
  );
}

function LongWritingTask({ sectionId, data, loading, error, badge, minWords, textareaLabel, showDiscussion = false }) {
  const [idx, setIdx] = useState(null);
  const [response, setResponse] = useState("");
  const [showSample, setShowSample] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState(null);
  const [results, setResults] = useState(() => getSectionResults(`writing_${sectionId}`));
  const info = WRITING_INFO[sectionId];
  const timerSeconds = sectionId === "email" ? 7 * 60 : 10 * 60;
  const remainingSeconds = useAutoCountdown(timerStartedAt, timerSeconds);

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

  const row = data[idx];
  const words = countWords(response);

  function resetQuestion(nextIdx = idx) {
    setIdx(nextIdx);
    setResponse("");
    setShowSample(false);
    setTimerStartedAt(Date.now());
  }

  function handleShowSample() {
    recordWordCount(`writing_${sectionId}`, idx, countWords(response));
    setResults(getSectionResults(`writing_${sectionId}`));
    setShowSample(true);
  }

  return (
    <div className="question-card writing-card">
      <QuestionHeader
        badge={getQuestionBadge(idx)}
        instruction={info.instruction}
        meta={formatTime(remainingSeconds)}
        onBack={() => setIdx(null)}
      />

      <div className="task-layout">
        <section className="task-material">
          {row.topic && <TextBlock className="prompt-text-block" text={row.topic} />}
          {row.instruction && <TextBlock className="instruction-box" text={row.instruction} />}
          {showDiscussion && row.discussion && (
            <TextBlock className="discussion-box" text={row.discussion} />
          )}
        </section>

        <section className="response-panel">
          <div className="response-header">
            <label htmlFor="writing-response">{textareaLabel}</label>
            <span>{words} words</span>
          </div>
          <textarea
            id="writing-response"
            className="writing-textarea"
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            placeholder={`Write at least ${minWords} words.`}
          />
          <div className={words >= minWords ? "word-status ready" : "word-status"}>
            {words >= minWords ? "Word target reached" : `${Math.max(minWords - words, 0)} words to target`}
          </div>
        </section>
      </div>

      {showSample && row.sample && (
        <div className="sample-answer">
          <strong>Sample response</strong>
          <TextBlock text={row.sample} />
        </div>
      )}

      <QuestionActions
        idx={idx}
        total={data.length}
        checked={showSample}
        onPrev={() => resetQuestion(Math.max(idx - 1, 0))}
        onCheck={handleShowSample}
        onNext={() => resetQuestion(Math.min(idx + 1, data.length - 1))}
        checkLabel="Show sample"
      />
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

function splitWords(value = "") {
  return value
    .split("|")
    .map((word) => word.trim())
    .filter(Boolean);
}

function normalizeAnswer(value = "") {
  return value.toLowerCase().replace(/[.,!?;:]/g, "").replace(/\s+/g, " ").trim();
}

function countWords(value = "") {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function QuestionHeader({ badge, instruction, meta, onBack }) {
  return (
    <div className="question-meta">
      <div>
        <span className="q-badge">{badge}</span>
        <h2 className="question-instruction">{instruction}</h2>
      </div>
      <div className="question-tools">
        {meta && <span className="q-count">{meta}</span>}
        <button className="btn-secondary compact" onClick={onBack}>List</button>
      </div>
    </div>
  );
}

function QuestionActions({ idx, total, checked, onPrev, onCheck, onNext, checkLabel = "Check answer", extraAction }) {
  return (
    <div className="card-actions">
      <button className="btn-secondary" onClick={onPrev} disabled={idx === 0}>Prev</button>
      <div className="action-cluster">
        {extraAction}
        {!checked && <button className="btn-primary" onClick={onCheck}>{checkLabel}</button>}
      </div>
      <button className="btn-secondary" onClick={onNext} disabled={idx === total - 1}>Next</button>
    </div>
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

function useAutoCountdown(startedAt, initialSeconds) {
  const now = useCurrentTime(startedAt !== null);

  if (startedAt === null) return initialSeconds;

  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return Math.max(initialSeconds - elapsedSeconds, 0);
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