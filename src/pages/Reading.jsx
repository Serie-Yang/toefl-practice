import { useState } from "react";
import emailjs from "@emailjs/browser";
import { useSheetData } from "../hooks/useSheetData";
import { useSectionProgress } from "../useProgress";
import { useAuth } from "../context/AuthContext";

const SECTIONS = [
  { id: "complete", label: "Complete the Words" },
  { id: "daily", label: "Read in Daily Life" },
  { id: "academic", label: "Read an Academic Passage" },
];

const READING_INFO = {
  complete: {
    title: "30문항",
    instruction: "Fill in the missing letters in a paragraph.",
    description: "제공된 첫 문장 이후 두 번째 단어마다 뒷부분이 삭제됩니다. 문법과 문맥에 유의하여 삭제된 10개의 빈칸에 글자를 채워 문장을 완성하세요.",
    tips: [
      "앞뒤 문맥을 먼저 읽고 품사(명사/동사/형용사)를 파악하면 철자 유추가 쉬워집니다.",
      "동사라면 시제와 수 일치(단수/복수)를 반드시 확인하세요.",
    ],
  },
  daily: {
    title: "5-15문항",
    instruction: "Read a short everyday text and answer 2–3 multiple-choice questions.",
    description: "일상에서 접할 수 있는 포스터, 이메일, SNS 게시물, 뉴스 기사 등 짧은 비학술 텍스트가 주어집니다. 내용을 파악한 후 2~3개의 객관식 문제에 답하세요.",
    tips: [
      "문제를 먼저 읽고 무엇을 찾아야 하는지 확인한 뒤 본문을 읽으면 시간을 절약할 수 있습니다.",
      "오답 보기는 본문 단어를 그대로 사용하면서 의미를 살짝 바꾸는 경우가 많습니다. 핵심 의미가 정확히 일치하는지 확인하세요.",
      "정답은 대부분 본문에서 직접 확인할 수 있습니다. 자신의 경험이나 상식보다 지문의 정보로 객관적 판단을 하는 것이 필요합니다.",
    ],
  },
  academic: {
    title: "5-15문항",
    instruction: "Read an academic passage and answer 5 multiple-choice questions.",
    description: "역사, 예술, 경제, 과학 등 학문적 주제의 지문이 주어집니다. 사전 배경 지식 없이도 풀 수 있으며, 사실 확인, 어휘, 추론 등 5개의 객관식 문제에 답하세요.",
    tips: [
      "각 단락의 첫 문장을 읽으면 글의 구조와 핵심 내용을 빠르게 파악할 수 있습니다.",
      "어휘 문제는 해당 단어를 지우고 선택지를 대입해 문맥에 가장 자연스러운 것을 고르세요.",
      "추론 문제도 반드시 지문 근거가 있어야 합니다. '그럴 것 같다'는 선택지는 오답일 가능성이 높습니다.",
    ],
  },
};

export default function Reading() {
  const [activeSection, setActiveSection] = useState("complete");

  return (
    <div className="page-container wide">
      <div className="section-tabs">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            className={activeSection === section.id ? "section-tab active" : "section-tab"}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="question-area">
        {activeSection === "complete" && <CompleteTheWords />}
        {activeSection === "daily" && (
          <ReadingPassage sectionId="daily" sheetKey="daily_life" maxQuestions={3} />
        )}
        {activeSection === "academic" && (
          <ReadingPassage sectionId="academic" sheetKey="academic_passage" maxQuestions={5} />
        )}
      </div>
    </div>
  );
}

function CompleteTheWords() {
  const { data, loading, error } = useSheetData("complete_words");
  const { results, recordCloze, clozeHistory } = useSectionProgress("reading_complete");
  const [idx, setIdx] = useState(null);
  const [inputs, setInputs] = useState({});
  const [checked, setChecked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const { user } = useAuth();
  const info = READING_INFO.complete;

  if (loading) return <LoadingCard />;
  if (error) return <ErrorCard message={error} />;
  if (!data.length) return <EmptyCard />;
  if (idx === null) {
    return <SectionHome info={info} items={data} results={results} onSelect={(i) => resetQuestion(i)} />;
  }

  const row = data[idx];
  const answers = Array.from({ length: 10 }, (_, i) => row[`answer_${i + 1}`]).filter(Boolean);
  const tokens = buildBlankTokens(row.text, answers.length);

  function getInputValue(blankIndex) {
    return (inputs[blankIndex] ?? []).join("");
  }

  function resetQuestion(nextIdx = idx) {
    setIdx(nextIdx);
    setInputs({});
    setChecked(false);
    setShowReport(false);
  }

  async function handleCheck() {
    const typedValues = answers.map((_, i) => getInputValue(i));
    await recordCloze(idx, typedValues, answers);
    setChecked(true);
  }

  // 채점 후: index 0이 방금 제출한 시도 → slice(1)부터가 이전 시도
  const currentClozeHistory = clozeHistory[idx] ?? [];
  const previousClozeAttempts = checked ? currentClozeHistory.slice(1) : currentClozeHistory;

  return (
    <div className="question-card reading-card">
      <QuestionHeader
        badge={getQuestionBadge(idx)}
        instruction="Fill in the missing letters in the paragraph."
        onBack={() => setIdx(null)}
        onReport={() => setShowReport(true)}
      />
      <div className="passage-box cloze-passage">
        {tokens.map((token, tokenIdx) => {
          if (token.type === "text") return <span key={tokenIdx}>{token.value}</span>;

          const answer = answers[token.blankIndex] ?? "";
          const letterCount = token.letterCount ?? answer.length;
          const letters = inputs[token.blankIndex] ?? Array(letterCount).fill("");
          const typedValue = letters.join("");
          const isCorrect = normalizeAnswer(typedValue) === normalizeAnswer(answer);

          function handleLetterChange(letterIdx, char) {
            const next = [...(inputs[token.blankIndex] ?? Array(letterCount).fill(""))];
            next[letterIdx] = char.slice(-1);
            setInputs((prev) => ({ ...prev, [token.blankIndex]: next }));
            if (char && letterIdx < letterCount - 1) {
              document.getElementById(`blank-${token.blankIndex}-${letterIdx + 1}`)?.focus();
            }
          }

          function handleLetterKeyDown(letterIdx, e) {
            if (e.key === "Backspace" && !letters[letterIdx] && letterIdx > 0) {
              document.getElementById(`blank-${token.blankIndex}-${letterIdx - 1}`)?.focus();
            }
          }

          return (
            <span className="letter-blank-wrap" key={tokenIdx}>
              {Array.from({ length: letterCount }, (_, letterIdx) => (
                <input
                  key={letterIdx}
                  id={`blank-${token.blankIndex}-${letterIdx}`}
                  className={`letter-input ${checked ? (isCorrect ? "correct" : "incorrect") : ""}`}
                  value={letters[letterIdx] ?? ""}
                  onChange={(e) => handleLetterChange(letterIdx, e.target.value)}
                  onKeyDown={(e) => handleLetterKeyDown(letterIdx, e)}
                  disabled={checked}
                  maxLength={1}
                />
              ))}
              {checked && (
                <span className={`inline-answer ${isCorrect ? "" : "incorrect-answer"}`}>
                  {isCorrect ? "✓" : answer}
                </span>
              )}
            </span>
          );
        })}
      </div>

      {checked && previousClozeAttempts.length > 0 && (
        <ClozeAttemptHistory attempts={previousClozeAttempts} answers={answers} />
      )}

      <QuestionActions
        idx={idx}
        total={data.length}
        checked={checked}
        onPrev={() => resetQuestion(Math.max(idx - 1, 0))}
        onCheck={handleCheck}
        onNext={() => resetQuestion(Math.min(idx + 1, data.length - 1))}
      />

      {showReport && (
        <ReportModal
          section="Reading - Complete the Words"
          problemNumber={idx + 1}
          problemLabel={getProblemLabel(row, idx)}
          userEmail={user?.email ?? ""}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

function ReadingPassage({ sectionId, sheetKey, maxQuestions }) {
  const { data, loading, error } = useSheetData(sheetKey);
  const { results, recordMc, mcHistory } = useSectionProgress(`reading_${sectionId}`);
  const [idx, setIdx] = useState(null);
  const [selected, setSelected] = useState({});
  const [checked, setChecked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const { user } = useAuth();
  const info = READING_INFO[sectionId];

  const sectionLabel =
    sectionId === "daily" ? "Reading - Read in Daily Life" : "Reading - Read an Academic Passage";

  if (loading) return <LoadingCard />;
  if (error) return <ErrorCard message={error} />;
  if (!data.length) return <EmptyCard />;
  if (idx === null) {
    return <SectionHome info={info} items={data} results={results} onSelect={(i) => resetQuestion(i)} />;
  }

  const row = data[idx];
  const questions = Array.from({ length: maxQuestions }, (_, i) => {
    const n = i + 1;
    return {
      n,
      q: row[`q${n}`],
      choices: { a: row[`q${n}_a`], b: row[`q${n}_b`], c: row[`q${n}_c`], d: row[`q${n}_d`] },
      answer: row[`q${n}_answer`]?.toLowerCase(),
    };
  }).filter((q) => q.q);

  function resetQuestion(nextIdx = idx) {
    setIdx(nextIdx);
    setSelected({});
    setChecked(false);
    setShowReport(false);
  }

  async function handleCheck() {
    const answerMap = {};
    questions.forEach((q) => { answerMap[q.n] = q.answer; });
    await recordMc(idx, selected, answerMap);
    setChecked(true);
  }

  // 현재 문제의 이전 시도 기록 (가장 최근이 index 0)
  const currentMcHistory = (mcHistory[idx] ?? []);
  // handleCheck 후 최신 시도가 index 0에 추가되므로,
  // checked 상태일 때 index 0은 방금 한 시도 → index 1부터가 "이전" 시도
  const previousAttempts = checked ? currentMcHistory.slice(1) : currentMcHistory;

  return (
    <div className="question-card reading-card">
      <QuestionHeader
        badge={getQuestionBadge(idx)}
        instruction={info.instruction}
        onBack={() => setIdx(null)}
        onReport={() => setShowReport(true)}
      />

      <div className="reading-layout">
        <section className="passage-panel">
          {row.title && <h2 className="passage-title">{row.title}</h2>}
          <div className="passage-box">
            {(row.passage ?? "").split(/\n/).map((line, i) => (
              <p key={i} style={{ margin: i === 0 ? 0 : "8px 0 0" }}>
                {parseBold(line || "\u00a0")}
              </p>
            ))}
          </div>
        </section>

        <section className="mc-questions">
          {questions.map(({ n, q, choices, answer }) => (
            <div key={n} className="mc-question">
              <p className="mc-q-text"><strong>Q{n}.</strong> {q}</p>
              {Object.entries(choices).map(([opt, val]) => {
                const isSelected = selected[n] === opt;
                const isCorrect = answer === opt;
                let cls = "mc-option";
                if (checked) {
                  if (isCorrect) cls += " correct";
                  else if (isSelected) cls += " incorrect";
                } else if (isSelected) {
                  cls += " selected";
                }
                return (
                  <button
                    key={opt}
                    className={cls}
                    onClick={() => !checked && setSelected((prev) => ({ ...prev, [n]: opt }))}
                  >
                    <span className="mc-opt-label">{opt.toUpperCase()}</span>
                    <span>{val}</span>
                  </button>
                );
              })}
              {checked && previousAttempts.length > 0 && (
                <AttemptHistory attempts={previousAttempts} questionN={n} answer={answer} />
              )}
            </div>
          ))}
        </section>
      </div>

      <QuestionActions
        idx={idx}
        total={data.length}
        checked={checked}
        onPrev={() => resetQuestion(Math.max(idx - 1, 0))}
        onCheck={handleCheck}
        onNext={() => resetQuestion(Math.min(idx + 1, data.length - 1))}
      />

      {showReport && (
        <ReportModal
          section={sectionLabel}
          problemNumber={idx + 1}
          problemLabel={getProblemLabel(row, idx)}
          userEmail={user?.email ?? ""}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

// attempts: 가장 최근 → 가장 오래된 (index 0이 직전 시도)
// answers: 정답 배열
function ClozeAttemptHistory({ attempts, answers }) {
  if (!attempts.length) return null;
  return (
    <div className="cloze-history">
      <div className="cloze-history-title">Previous attempts</div>
      <div className="cloze-history-grid">
        {attempts.map((attempt, i) => {
          const attemptNumber = attempts.length - i; // 오래된 게 1번
          return (
            <div key={i} className="cloze-history-row">
              <span className="cloze-attempt-label">Attempt {attemptNumber}</span>
              {(attempt.typed ?? []).map((val, blankIdx) => {
                const isCorrect = normalizeAnswer(val) === normalizeAnswer(answers[blankIdx] ?? "");
                return (
                  <span
                    key={blankIdx}
                    className={`cloze-cell ${isCorrect ? "correct" : "incorrect"}`}
                  >
                    {val || "—"}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// attempts: 가장 최근 → 가장 오래된 순서 (index 0이 직전 시도)
// questionN: 현재 질문 번호 (1-based)
// answer: 정답 옵션 ('a'/'b'/'c'/'d')
function AttemptHistory({ attempts, questionN, answer }) {
  if (!attempts.length) return null;
  return (
    <div className="attempt-history">
      {attempts.map((attempt, i) => {
        const chosen = attempt.selected?.[questionN];
        const isCorrect = chosen === answer;
        const attemptNumber = attempts.length - i; // 오래된 게 1번
        return (
          <span key={i} className="attempt-tag">
            <span className="attempt-label">Attempt {attemptNumber}</span>
            {chosen ? (
              <>
                <span className={`attempt-choice ${isCorrect ? "correct" : "incorrect"}`}>
                  {chosen.toUpperCase()}
                </span>
                <span className={`attempt-result ${isCorrect ? "correct" : "incorrect"}`}>
                  {isCorrect ? "✓" : "✗"}
                </span>
              </>
            ) : (
              <span className="attempt-choice unanswered">—</span>
            )}
          </span>
        );
      })}
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

function buildBlankTokens(text = "", answerCount = 0) {
  const tokens = [];
  const pattern = /_{1,}(?:\s*_{1,})*/g;
  let lastIndex = 0;
  let blankIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null && blankIndex < answerCount) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const letterCount = (match[0].match(/_/g) || []).length;
    tokens.push({ type: "blank", blankIndex, letterCount });
    blankIndex += 1;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  return tokens.length ? tokens : [{ type: "text", value: text }];
}

function normalizeAnswer(value = "") {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
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

function QuestionActions({ idx, total, checked, onPrev, onCheck, onNext }) {
  return (
    <div className="card-actions">
      <button className="btn-secondary" onClick={onPrev} disabled={idx === 0}>Prev</button>
      <div className="action-cluster">
        {!checked && <button className="btn-primary" onClick={onCheck}>Check answer</button>}
      </div>
      <button className="btn-secondary" onClick={onNext} disabled={idx === total - 1}>Next</button>
    </div>
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