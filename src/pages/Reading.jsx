import { useState } from "react";
import { useSheetData } from "../hooks/useSheetData";
import { getSectionResults, recordSectionAttempt, recordMcAttempts } from "../utils/progress";

const SECTIONS = [
  { id: "complete", label: "Complete the Words" },
  { id: "daily", label: "Read in Daily Life" },
  { id: "academic", label: "Read an Academic Passage" },
];

const READING_INFO = {
  complete: {
    title: "30문항",
    instruction: "Complete the missing letters in every second word to restore the original text.",
    description: "제공된 첫 문장 이후 두 번째 단어마다 뒷부분이 삭제됩니다. 문법과 문맥에 유의하여 삭제된 10개의 빈칸에 글자를 채워 문장을 완성하세요.",
  },
  daily: {
    title: "5-15문항",
    instruction: "Read a short everyday text and answer 2–3 multiple-choice questions.",
    description: "일상에서 접할 수 있는 포스터, 이메일, SNS 게시물, 뉴스 기사 등 짧은 비학술 텍스트가 주어집니다. 내용을 파악한 후 2~3개의 객관식 문제에 답하세요.",
  },
  academic: {
    title: "5-15문항",
    instruction: "Read a short academic passage and answer 5 multiple-choice questions.",
    description: "역사, 예술, 경제, 과학 등 학문적 주제의 지문이 주어집니다. 사전 배경 지식 없이도 풀 수 있으며, 사실 확인, 어휘, 추론 등 5개의 객관식 문제에 답하세요.",
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
          <ReadingPassage sectionId="daily" sheetKey="daily_life" badge="Daily Life" maxQuestions={3} />
        )}
        {activeSection === "academic" && (
          <ReadingPassage sectionId="academic" sheetKey="academic_passage" badge="Academic" maxQuestions={5} />
        )}
      </div>
    </div>
  );
}

function CompleteTheWords() {
  const { data, loading, error } = useSheetData("complete_words");
  const sectionKey = "reading_complete";
  const [idx, setIdx] = useState(null);
  const [inputs, setInputs] = useState({});
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState(() => getSectionResults(sectionKey));
  const info = READING_INFO.complete;

  if (loading) return <LoadingCard />;
  if (error) return <ErrorCard message={error} />;
  if (!data.length) return <EmptyCard />;
  if (idx === null) {
    return <SectionHome info={info} items={data} results={results} onSelect={(itemIdx) => resetQuestion(itemIdx)} />;
  }

  const row = data[idx];
  const answers = Array.from({ length: 10 }, (_, index) => row[`answer_${index + 1}`]).filter(Boolean);
  const tokens = buildBlankTokens(row.text, answers.length);

  function resetQuestion(nextIdx = idx) {
    setIdx(nextIdx);
    setInputs({});
    setChecked(false);
  }

  function handleCheck() {
    const correct = answers.every((answer, answerIdx) => normalizeAnswer(inputs[answerIdx]) === normalizeAnswer(answer));
    setResults(recordSectionAttempt(sectionKey, idx, correct));
    setChecked(true);
  }

  return (
    <div className="question-card reading-card">
      <QuestionHeader
        badge={getQuestionBadge(idx)}
        instruction="Fill in the missing letters in the paragraph."
        onBack={() => setIdx(null)}
      />
      <div className="passage-box cloze-passage">
        {tokens.map((token, tokenIdx) => {
          if (token.type === "text") return <span key={tokenIdx}>{token.value}</span>;
          const answer = answers[token.blankIndex] ?? "";
          const value = inputs[token.blankIndex] ?? "";
          const correct = normalizeAnswer(value) === normalizeAnswer(answer);

          return (
            <span className="inline-input-wrap" key={tokenIdx}>
              <input
                className={`inline-input ${checked ? (correct ? "correct" : "incorrect") : ""}`}
                value={value}
                onChange={(event) => setInputs((prev) => ({ ...prev, [token.blankIndex]: event.target.value }))}
                disabled={checked}
                placeholder={`${token.blankIndex + 1}`}
              />
              {checked && <span className="inline-answer">{correct ? "OK" : answer}</span>}
            </span>
          );
        })}
      </div>

      <QuestionActions
        idx={idx}
        total={data.length}
        checked={checked}
        onPrev={() => resetQuestion(Math.max(idx - 1, 0))}
        onCheck={handleCheck}
        onNext={() => resetQuestion(Math.min(idx + 1, data.length - 1))}
      />
    </div>
  );
}

function ReadingPassage({ sectionId, sheetKey, badge, maxQuestions }) {
  const { data, loading, error } = useSheetData(sheetKey);
  const sectionKey = `reading_${sectionId}`;
  const [idx, setIdx] = useState(null);
  const [selected, setSelected] = useState({});
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState(() => getSectionResults(sectionKey));
  const info = READING_INFO[sectionId];

  if (loading) return <LoadingCard />;
  if (error) return <ErrorCard message={error} />;
  if (!data.length) return <EmptyCard />;
  if (idx === null) {
    return <SectionHome info={info} items={data} results={results} onSelect={(itemIdx) => resetQuestion(itemIdx)} />;
  }

  const row = data[idx];
  const questions = Array.from({ length: maxQuestions }, (_, index) => {
    const n = index + 1;
    return {
      n,
      q: row[`q${n}`],
      choices: {
        a: row[`q${n}_a`],
        b: row[`q${n}_b`],
        c: row[`q${n}_c`],
        d: row[`q${n}_d`],
      },
      answer: row[`q${n}_answer`]?.toLowerCase(),
    };
  }).filter((question) => question.q);

  function resetQuestion(nextIdx = idx) {
    setIdx(nextIdx);
    setSelected({});
    setChecked(false);
  }

  function handleCheck() {
    const correctMap = {};
    questions.forEach((question) => {
      correctMap[question.n] = selected[question.n] === question.answer;
    });
    setResults(recordMcAttempts(sectionKey, idx, correctMap));
    setChecked(true);
  }

  return (
    <div className="question-card reading-card">
      <QuestionHeader
        badge={getQuestionBadge(idx)}
        instruction={info.instruction}
        onBack={() => setIdx(null)}
      />

      <div className="reading-layout">
        <section className="passage-panel">
          {row.title && <h2 className="passage-title">{row.title}</h2>}
          <div className="passage-box">{row.passage}</div>
        </section>

        <section className="mc-questions">
          {questions.map(({ n, q, choices, answer }) => (
            <div key={n} className="mc-question">
              <p className="mc-q-text">
                <strong>Q{n}.</strong> {q}
              </p>
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

function buildBlankTokens(text = "", answerCount = 0) {
  const tokens = [];
  const pattern = /(?:_{2,}(?:\s+_{2,})*)/g;
  let lastIndex = 0;
  let blankIndex = 0;
  let match;

  while ((match = pattern.exec(text)) && blankIndex < answerCount) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    tokens.push({ type: "blank", blankIndex });
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