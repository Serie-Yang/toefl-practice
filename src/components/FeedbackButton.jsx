import { useState } from "react";
import emailjs from "@emailjs/browser";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PAGE_LABELS = {
  "/reading": "Reading",
  "/writing": "Writing",
  "/speaking": "Speaking",
  "/mymenu": "My Menu",
  "/admin": "Admin",
};

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", right: 20, bottom: 20, zIndex: 150,
          background: "var(--blue)", color: "white", border: "none",
          borderRadius: 999, padding: "12px 18px", fontSize: 13, fontWeight: 800,
          cursor: "pointer", boxShadow: "0 8px 24px rgba(20,40,80,0.25)",
        }}
      >
        💬 피드백 보내기
      </button>
      {open && (
        <FeedbackModal
          userEmail={user?.email ?? ""}
          pageLabel={PAGE_LABELS[location.pathname] ?? location.pathname}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function FeedbackModal({ userEmail, pageLabel, onClose }) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("idle");

  async function handleSubmit() {
    if (!reason.trim()) return;
    setStatus("sending");
    try {
      emailjs.init("yTTgUnSO_K7drzPam");
      await emailjs.send("service_rqzbtkr", "template_lqa08fq", {
        section: `일반 피드백 (${pageLabel})`,
        problem_number: "-",
        problem_label: "-",
        user_email: userEmail || "비로그인 사용자",
        reason: reason.trim(),
        timestamp: new Date().toLocaleString("ko-KR"),
      });
      setStatus("done");
    } catch (err) {
      console.error("Feedback EmailJS error:", err);
      setStatus("error");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>💬 의견 보내기</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-meta">
          불편한 점, 추가됐으면 하는 기능, 무엇이든 자유롭게 남겨주세요.
        </div>

        {status === "done" ? (
          <div className="modal-success">
            소중한 의견 감사합니다! 확인 후 반영할게요.
            <br />
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={onClose}>닫기</button>
          </div>
        ) : (
          <>
            <textarea
              className="writing-textarea compact"
              placeholder="자유롭게 의견을 남겨주세요."
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
                {status === "sending" ? "전송 중..." : "보내기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}