import { useEffect, useMemo, useState } from "react";
import emailjs from "@emailjs/browser";
import { useSheetData } from "../hooks/useSheetData";
import { useSectionProgress } from "../useProgress";
import { useMySubmissions } from "../useSubmissions";
import { useAuth } from "../context/AuthContext";

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
    tips: [
      "주어와 동사를 먼저 찾아 문장의 뼈대를 만든 뒤 나머지 요소를 배치하세요.",
      "who, which, that, where가 보이면 관계절일 가능성이 높습니다. 관계사가 수식하는 명사를 먼저 찾으세요.",
      "문장이 질문이라면 조동사(do, does, did, can, will)가 주어 앞에 오는지 확인하세요.",
    ],
  },
  email: {
    title: "1문항",
    instruction: "Write a purposeful email responding to the given scenario.",
    description: "학교 또는 일상 상황이 주어지며, 요청/초대/문제 해결 등 특정 목적의 이메일을 작성합니다. 명확하고 자연스러운 영어로 목적을 달성하는 글쓰기 능력을 평가합니다.",
    tips: [
      "첫 문장에서 이메일의 목적을 바로 밝히세요. (I am writing to ask about..., I am writing to request...)",
      "문제에서 요구한 모든 항목을 반드시 포함하세요. AI 채점에서 하나라도 빠지면 점수가 크게 떨어질 수 있습니다.",
      "마무리는 정중하게 작성하세요. (Thank you for your time. / I look forward to hearing from you.)",
      "7분동안 130단어 작성을 목표로 연습하세요."
    ],
  },
  discussion: {
    title: "1문항",
    instruction: "State and support your opinion in an online academic discussion forum.",
    description: "교수의 질문과 다른 학생들의 의견이 포함된 온라인 토론 게시판 형식입니다. 주어진 주제에 대한 자신의 의견을 논리적인 근거와 함께 작성하세요. ",
    tips: [
      "첫 문장에서 자신의 의견을 명확하게 제시하세요. (I believe that... / In my opinion...)",
      "다른 학생의 의견을 언급한 뒤 자신의 생각을 덧붙이면 토론 참여도가 높아 보입니다. AI 채점에서 이 부분이 중요하게 평가됩니다.",
      "이유와 구체적인 개인적/사회적 예시를 포함하면 의견이 더 설득력 있게 전달됩니다. AI 채점에서 이 부분이 중요하게 평가됩니다.",
      "10분동안 120단어 작성을 목표로 연습하세요."
    ],
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
  const { results, record } = useSectionProgress("writing_sentence");
  const [idx, setIdx] = useState(null);
  const [picked, setPicked] = useState([]);
  const [checked, setChecked] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState(null);
  const [timerExpired, setTimerExpired] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const { user } = useAuth();
  const info = WRITING_INFO.sentence;
  const SENTENCE_SECONDS = 45;

  const now = useCurrentTime(timerStartedAt !== null && !checked);
  const elapsed = timerStartedAt ? Math.floor((now - timerStartedAt) / 1000) : 0;
  const remaining = Math.max(SENTENCE_SECONDS - elapsed, 0);

  useEffect(() => {
    if (timerStartedAt && remaining === 0 && !checked && !timerExpired) {
      setTimerExpired(true);
      record(idx, false);
    }
  }, [remaining, checked, timerStartedAt, timerExpired]);

  const row = idx === null ? null : data[idx];
  const words = useMemo(() => splitWords(row?.words), [row]);
  const answer = row?.answer?.trim() ?? "";
  const userAnswer = picked.map((item) => item.word).join(" ");
  const isCorrect = !timerExpired && normalizeAnswer(userAnswer) === normalizeAnswer(answer);

  const usedIndices = useMemo(() => new Set(picked.map((item) => item.sourceIndex)), [picked]);

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

  function addWord(word, sourceIndex) {
    if (checked || usedIndices.has(sourceIndex)) return;
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
    setTimerStartedAt(Date.now());
    setTimerExpired(false);
    setShowReport(false);
  }

  async function handleCheck() {
    if (!timerExpired) await record(idx, isCorrect);
    setChecked(true);
  }

  const timerColor = remaining <= 10 ? "var(--red)" : remaining <= 20 ? "#e65100" : "var(--blue)";

  return (
    <div className="question-card writing-card">
      <QuestionHeader
        badge={getQuestionBadge(idx)}
        instruction={info.instruction}
        meta={<span style={{ color: timerColor, fontWeight: 800 }}>{formatTime(remaining)}</span>}
        onBack={() => setIdx(null)}
        onReport={() => setShowReport(true)}
      />

      {timerExpired && !checked && (
        <div className="feedback-box incorrect" style={{ marginBottom: 12 }}>
          시간이 초과되었습니다. 제출하면 오답 처리됩니다.
        </div>
      )}

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
        {words.map((word, sourceIndex) => {
          const used = usedIndices.has(sourceIndex);
          return (
            <button
              key={`${word}-${sourceIndex}`}
              className={`word-chip${used ? " word-chip-used" : ""}`}
              onClick={() => addWord(word, sourceIndex)}
              disabled={checked || used}
            >
              {word}
            </button>
          );
        })}
      </div>

      {checked && (
        <div className={`feedback-box ${isCorrect ? "correct" : "incorrect"}`} style={{ marginTop: 16 }}>
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

      {showReport && (
        <ReportModal
          section="Writing - Build a Sentence"
          problemNumber={idx + 1}
          problemLabel={getProblemLabel(row, idx)}
          userEmail={user?.email ?? ""}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

function WriteAnEmail() {
  const { data, loading, error } = useSheetData("email");
  return <EmailTask data={data} loading={loading} error={error} />;
}

function AcademicDiscussion() {
  const { data, loading, error } = useSheetData("discussion");
  return <DiscussionTask data={data} loading={loading} error={error} />;
}

function EmailTask({ data, loading, error }) {
  const { results, recordWords, getLastDraft, writingHistory } = useSectionProgress("writing_email");
  const { submissions, submit: submitForReview } = useMySubmissions("writing_email");
  const [idx, setIdx] = useState(null);
  const [response, setResponse] = useState("");
  const [showSample, setShowSample] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState(null);
  const [frozenSeconds, setFrozenSeconds] = useState(null); // 멈춘 시간 저장
  const [showReport, setShowReport] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [feedbackSub, setFeedbackSub] = useState(null);
  const { user } = useAuth();
  const info = WRITING_INFO.email;
  const TOTAL_SECONDS = 7 * 60;
  const minWords = 100;
  const countingSeconds = useAutoCountdown(timerStartedAt, TOTAL_SECONDS);
  const remainingSeconds = frozenSeconds !== null ? frozenSeconds : countingSeconds;

  // 자동저장: response가 바뀌면 2초 후 저장
  useDebounceAutoSave(
    response, idx, timerStartedAt, recordWords,
    frozenSeconds !== null ? TOTAL_SECONDS - frozenSeconds : null
  );

  if (loading) return <LoadingCard />;
  if (error) return <ErrorCard message={error} />;
  if (!data.length) return <EmptyCard />;
  if (idx === null) {
    return (
      <SectionHome info={info} items={data} results={results}
        writingHistory={writingHistory}
        submissions={submissions}
        renderDots={(itemIdx) => (
          <WritingStatusDots
            history={writingHistory[itemIdx]}
            targetWords={120}
            subList={submissions[itemIdx] ?? []}
            onFeedbackClick={(sub) => setFeedbackSub(sub)}
          />
        )}
        onSelect={(i) => openQuestion(i)}
      />
    );
  }

  const row = data[idx];
  const words = countWords(response);
  const problemLabel = getProblemLabel(row, idx);
  const latestSub = (submissions[idx] ?? [])[0] ?? null;

  function openQuestion(nextIdx) {
    const draft = getLastDraft ? getLastDraft(nextIdx) : "";
    const lastElapsed = writingHistory[nextIdx]?.[0]?.elapsedSeconds ?? null;
    // 이전에 멈춘 시간이 있으면 복원, 없으면 타이머 새로 시작
    const hasFrozen = lastElapsed !== null;
    const restored = hasFrozen ? Math.max(TOTAL_SECONDS - lastElapsed, 0) : null;
    setIdx(nextIdx);
    setResponse(draft);
    setShowSample(false);
    setTimerStartedAt(hasFrozen ? null : Date.now()); // frozen이면 타이머 안 켬
    setFrozenSeconds(restored);
    setShowReport(false);
    setSubmitStatus("idle");
  }

  async function handleReset() {
    setResponse("");
    setShowSample(false);
    setTimerStartedAt(Date.now());
    setFrozenSeconds(null);
    setSubmitStatus("idle");
    await recordWords(idx, 0, "", null); 
  }

  function handleShowSample() {
    setFrozenSeconds(countingSeconds);
    setTimerStartedAt(null);
    setShowSample(true);
  }

  async function handleSubmitForReview() {
    if (!response.trim()) return;
    setFrozenSeconds(countingSeconds);
    setTimerStartedAt(null);
    setSubmitStatus("sending");
    try {
      await submitForReview(idx, problemLabel, response, words);
      setSubmitStatus("done");
    } catch {
      setSubmitStatus("error");
    }
  }

  return (
    <div className="question-card writing-card">
      <QuestionHeader badge={getQuestionBadge(idx)} instruction={info.instruction}
        meta={formatTime(remainingSeconds)} onBack={() => setIdx(null)}
        onReport={() => setShowReport(true)} />

      <div className="task-layout">
        <section className="task-material">
          {row.topic && <TextBlock className="prompt-text-block" text={row.topic} />}
          {row.instruction && (
            <div style={{ fontSize: 14, color: "var(--gray-600)", lineHeight: 1.6, marginTop: 10 }}>
              {row.instruction.split(/\n/).map((line, i) => (
                <p key={i} style={{ margin: 0, marginTop: i === 0 ? 0 : 4 }}>{line || "\u00a0"}</p>
              ))}
            </div>
          )}
        </section>

        <section className="response-panel">
          <div className="response-header">
            <label htmlFor="email-response">Email response</label>
            <span>{words} words</span>
          </div>
          <textarea id="email-response" className="writing-textarea" value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder={`Write at least ${minWords} words.`} />
          <div className={words >= minWords ? "word-status ready" : "word-status"}>
            {words >= minWords ? "Word target reached" : `${Math.max(minWords - words, 0)} words to target`}
          </div>
          {/* Reset / Show sample 버튼을 패널 안으로 */}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn-secondary" style={{ fontSize: 13, padding: "6px 12px" }} onClick={handleReset}>Reset</button>
            {!showSample && (
              <button className="btn-secondary" style={{ fontSize: 13, padding: "6px 12px" }} onClick={handleShowSample}>Show sample</button>
            )}
          </div>
        </section>
      </div>

      {showSample && row.sample && (
        <div className="sample-answer">
          <strong style={{ display: "block", marginBottom: 12 }}>Sample response</strong>
          <TextBlock text={row.sample} isSample />
        </div>
      )}

      {/* 피드백 받기 섹션 */}
      <SubmitForReviewSection
        response={response}
        status={submitStatus}
        latestSub={latestSub}
        onSubmit={handleSubmitForReview}
        onViewFeedback={() => setFeedbackSub(latestSub)}
      />

      {showReport && (
        <ReportModal
          section="Writing - Write an Email"
          problemNumber={idx + 1}
          problemLabel={problemLabel}
          userEmail={user?.email ?? ""}
          onClose={() => setShowReport(false)}
        />
      )}

      {feedbackSub && (
        <FeedbackModal sub={feedbackSub} onClose={() => setFeedbackSub(null)} />
      )}
    </div>
  );
}

function DiscussionTask({ data, loading, error }) {
  const { results, recordWords, getLastDraft, writingHistory } = useSectionProgress("writing_discussion");
  const { submissions, submit: submitForReview } = useMySubmissions("writing_discussion");
  const [idx, setIdx] = useState(null);
  const [response, setResponse] = useState("");
  const [showSample, setShowSample] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState(null);
  const [frozenSeconds, setFrozenSeconds] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [feedbackSub, setFeedbackSub] = useState(null);
  const { user } = useAuth();
  const info = WRITING_INFO.discussion;
  const TOTAL_SECONDS = 10 * 60;
  const minWords = 100;
  const countingSeconds = useAutoCountdown(timerStartedAt, TOTAL_SECONDS);
  const remainingSeconds = frozenSeconds !== null ? frozenSeconds : countingSeconds;

  // 자동저장: response가 바뀌면 2초 후 저장
  useDebounceAutoSave(
    response, idx, timerStartedAt, recordWords,
    frozenSeconds !== null ? TOTAL_SECONDS - frozenSeconds : null
  );
  
  if (loading) return <LoadingCard />;
  if (error) return <ErrorCard message={error} />;
  if (!data.length) return <EmptyCard />;
  if (idx === null) {
    return (
      <SectionHome info={info} items={data} results={results}
        writingHistory={writingHistory}
        submissions={submissions}
        renderDots={(itemIdx) => (
          <WritingStatusDots
            history={writingHistory[itemIdx]}
            targetWords={120}
            subList={submissions[itemIdx] ?? []}
            onFeedbackClick={(sub) => setFeedbackSub(sub)}
          />
        )}
        onSelect={(i) => openQuestion(i)}
      />
    );
  }

  const row = data[idx];
  const words = countWords(response);
  const problemLabel = getProblemLabel(row, idx);
  const latestSub = (submissions[idx] ?? [])[0] ?? null;

  function openQuestion(nextIdx) {
    const draft = getLastDraft ? getLastDraft(nextIdx) : "";
    const lastElapsed = writingHistory[nextIdx]?.[0]?.elapsedSeconds ?? null;
    const hasFrozen = lastElapsed !== null;
    const restored = hasFrozen ? Math.max(TOTAL_SECONDS - lastElapsed, 0) : null;
    setIdx(nextIdx);
    setResponse(draft);
    setShowSample(false);
    setTimerStartedAt(hasFrozen ? null : Date.now());
    setFrozenSeconds(restored);
    setShowReport(false);
    setSubmitStatus("idle");
  }

  async function handleReset() {
    setResponse("");
    setShowSample(false);
    setTimerStartedAt(Date.now());
    setFrozenSeconds(null);
    setSubmitStatus("idle");
    await recordWords(idx, 0, "", null); 
  }

  function handleShowSample() {
    setFrozenSeconds(countingSeconds); // 현재 남은 시간에서 freeze
    setTimerStartedAt(null);
    setShowSample(true);
  }

  async function handleSubmitForReview() {
    if (!response.trim()) return;
    setFrozenSeconds(countingSeconds); // 현재 남은 시간에서 freeze
    setTimerStartedAt(null);
    setSubmitStatus("sending");
    try {
      await submitForReview(idx, problemLabel, response, words);
      setSubmitStatus("done");
    } catch {
      setSubmitStatus("error");
    }
  }

  return (
    <div className="question-card writing-card">
      <QuestionHeader badge={getQuestionBadge(idx)} instruction={info.instruction}
        meta={formatTime(remainingSeconds)} onBack={() => setIdx(null)}
        onReport={() => setShowReport(true)} />

      <div className="task-layout">
        <section className="task-material">
          {row.instruction && (
            <div style={{ fontSize: 14, color: "var(--gray-600)", lineHeight: 1.6, marginBottom: 12 }}>
              {row.instruction.split(/\n/).map((line, i) => (
                <p key={i} style={{ margin: 0, marginTop: i === 0 ? 0 : 4 }}>{line || "\u00a0"}</p>
              ))}
            </div>
          )}
          {row.professor && <TextBlock className="instruction-box" text={row.professor} />}
          {row.discussion && <TextBlock className="discussion-box" text={row.discussion} />}
        </section>

        <section className="response-panel">
          <div className="response-header">
            <label htmlFor="discussion-response">Discussion post</label>
            <span>{words} words</span>
          </div>
          <textarea id="discussion-response" className="writing-textarea" value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder={`Write at least ${minWords} words.`} />
          <div className={words >= minWords ? "word-status ready" : "word-status"}>
            {words >= minWords ? "Word target reached" : `${Math.max(minWords - words, 0)} words to target`}
          </div>
          {/* Reset / Show sample 버튼을 패널 안으로 */}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn-secondary" style={{ fontSize: 13, padding: "6px 12px" }} onClick={handleReset}>Reset</button>
            {!showSample && (
              <button className="btn-secondary" style={{ fontSize: 13, padding: "6px 12px" }} onClick={handleShowSample}>Show sample</button>
            )}
          </div>

          {showSample && row.sample && (
            <div className="sample-answer" style={{ marginTop: 16 }}>
              <strong style={{ display: "block", marginBottom: 12 }}>Sample response</strong>
              <TextBlock text={row.sample} isSample />
            </div>
          )}
        </section>
      </div>

      {/* 피드백 받기 섹션 */}
      <SubmitForReviewSection
        response={response}
        status={submitStatus}
        latestSub={latestSub}
        onSubmit={handleSubmitForReview}
        onViewFeedback={() => setFeedbackSub(latestSub)}
      />

      {showReport && (
        <ReportModal
          section="Writing - Academic Discussion"
          problemNumber={idx + 1}
          problemLabel={problemLabel}
          userEmail={user?.email ?? ""}
          onClose={() => setShowReport(false)}
        />
      )}

      {feedbackSub && (
        <FeedbackModal sub={feedbackSub} onClose={() => setFeedbackSub(null)} />
      )}
    </div>
  );
}

function SectionHome({ info, items, results, onSelect, renderDots }) {
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
            {renderDots ? renderDots(itemIdx) : <ResultDots attempts={results[itemIdx]} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// history: writingHistory[itemIdx], subList: submissions[itemIdx]
function WritingStatusDots({ history, targetWords, subList = [], onFeedbackClick }) {
  const recent = history?.[0]?.wordCount ?? 0;
  const reached = history && history.length > 0 && recent >= targetWords;
  const latestSub = subList[0] ?? null;

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      {/* 단어 수 뱃지 */}
      {history && history.length > 0 ? (
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 999,
          background: reached ? "var(--green-light)" : "var(--gray-100)",
          color: reached ? "var(--green)" : "var(--gray-600)",
          border: `1px solid ${reached ? "#c8e6c9" : "var(--gray-200)"}`,
        }}>
          {recent}
        </span>
      ) : (
        <span className="result-dot" />
      )}

      {/* 제출 상태 뱃지 */}
      {latestSub && (
        latestSub.status === "reviewed" ? (
          <button
            onClick={(e) => { e.stopPropagation(); onFeedbackClick(latestSub); }}
            style={{
              fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
              background: "var(--blue-light)", color: "var(--blue)",
              border: "1.5px solid var(--blue-mid)", cursor: "pointer",
            }}
          >
            {latestSub.score}점
          </button>
        ) : (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
            background: "#fffbeb", color: "#92400e",
            border: "1px solid #fde68a",
          }}>
            검토중
          </span>
        )
      )}
    </span>
  );
}

// ── Submit for Review 영역 ─────────────────────────────────
function SubmitForReviewSection({ response, status, latestSub, onSubmit, onViewFeedback }) {
  const hasText = response.trim().length > 0;

  return (
    <div style={{
      marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--gray-200)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-800)" }}>
          선생님 피드백 받기
        </div>
        <div style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 2 }}>
          작성한 글을 제출하면 점수와 피드백을 받을 수 있습니다.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {latestSub?.status === "reviewed" && (
          <button className="btn-secondary" onClick={onViewFeedback}>
            피드백 보기
          </button>
        )}
        {latestSub?.status === "pending" ? (
          <span style={{
            fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 7,
            background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a",
          }}>
            ⏳ 검토 중
          </span>
        ) : (
          <button
            className="btn-primary"
            onClick={onSubmit}
            disabled={!hasText || status === "sending"}
          >
            {status === "sending" ? "제출 중..." : status === "done" ? "제출 완료 ✓" : "제출하기"}
          </button>
        )}
      </div>
      {status === "error" && (
        <div className="error-message" style={{ width: "100%", marginTop: 4 }}>
          제출에 실패했습니다. 다시 시도해주세요.
        </div>
      )}
    </div>
  );
}

// ── 피드백 상세 팝업 ──────────────────────────────────────
function FeedbackModal({ sub, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 680, width: "100%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-header">
          <span>📝 피드백 결과</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-meta" style={{ marginBottom: 18 }}>
          {sub.problemLabel} · {new Date(sub.submittedAt).toLocaleDateString("ko-KR")}
        </div>

        {/* 점수 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16, marginBottom: 20,
          padding: "14px 18px", background: "var(--blue-light)", borderRadius: 8,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.04em" }}>TOEFL Writing Score</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "var(--blue)", lineHeight: 1.1 }}>{sub.score}<span style={{ fontSize: 16 }}> / 6.0</span></div>
          </div>
        </div>

        {/* 코멘트 */}
        {sub.comment && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-400)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Comment</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--gray-800)", whiteSpace: "pre-wrap" }}>{sub.comment}</div>
          </div>
        )}

        {/* 내 글 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-400)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>내가 쓴 글</div>
          <div style={{
            background: "#f8faff", border: "1px solid var(--gray-200)", borderRadius: 8,
            padding: "14px 16px", fontSize: 14, lineHeight: 1.7, color: "var(--gray-800)",
            whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto",
          }}>
            {sub.draft}
          </div>
        </div>

        {/* Revised - HTML 피드백 파일 */}
        {sub.revised && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-400)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>피드백 파일</div>
            <iframe
              srcDoc={sub.revised}
              style={{
                width: "100%", height: 480,
                border: "1px solid #c8e6c9", borderRadius: 8,
                background: "var(--green-light)",
              }}
              title="피드백"
              sandbox="allow-same-origin"
            />
          </div>
        )}

        <div style={{ textAlign: "right" }}>
          <button className="btn-primary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function ResultDots({ attempts = [] }) {
  const dots = Array.from({ length: 3 }, (_, i) => attempts[i]);
  return (
    <span className="result-dots" aria-label="Recent results">
      {dots.map((result, i) => (
        <span key={i} className={`result-dot ${result === true ? "correct" : result === false ? "incorrect" : ""}`} />
      ))}
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
    } catch {
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

function splitWords(value = "") {
  return value.split("|").map((w) => w.trim()).filter(Boolean);
}

function normalizeAnswer(value = "") {
  return value.toLowerCase().replace(/[.,!?;:]/g, "").replace(/\s+/g, " ").trim();
}

function countWords(value = "") {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function QuestionHeader({ badge, instruction, meta, onBack, onReport }) {
  return (
    <div className="question-meta">
      <div>
        <span className="q-badge">{badge}</span>
        <h2 className="question-instruction">{instruction}</h2>
      </div>
      <div className="question-tools">
        {meta && <span className="q-count">{meta}</span>}
        <button className="btn-secondary compact" onClick={onReport}>🚨 Report</button>
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
        {onCheck && !checked && <button className="btn-primary" onClick={onCheck}>{checkLabel}</button>}
      </div>
      <button className="btn-secondary" onClick={onNext} disabled={idx === total - 1}>Next</button>
    </div>
  );
}

// 자동저장: response가 바뀌면 2초 후 Firestore에 저장
function useDebounceAutoSave(response, idx, timerStartedAt, recordWords, frozenElapsedSeconds = null) {
  useEffect(() => {
    if (idx === null || !response.trim()) return;
    const timer = window.setTimeout(async () => {
      const elapsedSeconds = frozenElapsedSeconds !== null
        ? frozenElapsedSeconds
        : (timerStartedAt ? Math.floor((Date.now() - timerStartedAt) / 1000) : null);
      await recordWords(idx, countWords(response), response, elapsedSeconds);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [response, idx, frozenElapsedSeconds]);
}

function parseBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

function TextBlock({ className, text, isSample = false }) {
  const pStyle = isSample ? { margin: 0, marginTop: 2, lineHeight: 1.6 } : {};
  return (
    <div className={className}>
      {text.split(/\n/).map((line, i) => (
        <p key={i} style={isSample ? { ...pStyle, marginTop: i === 0 ? 0 : 2 } : {}}>
          {parseBold(line || "\u00a0")}
        </p>
      ))}
    </div>
  );
}

function useAutoCountdown(startedAt, initialSeconds) {
  const now = useCurrentTime(startedAt !== null);
  if (startedAt === null) return initialSeconds;
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  return Math.max(initialSeconds - elapsed, 0);
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