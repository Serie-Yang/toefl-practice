import { useState } from "react";
import { auth } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/");
    } catch (err) {
      if (err.code === "auth/invalid-credential") setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      else if (err.code === "auth/email-already-in-use") setError("이미 사용 중인 이메일입니다.");
      else if (err.code === "auth/weak-password") setError("비밀번호는 6자 이상이어야 합니다.");
      else if (err.code === "auth/invalid-email") setError("유효하지 않은 이메일 형식입니다.");
      else setError("오류가 발생했습니다. 다시 시도해주세요.");
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>TOEFL Practice</h1>
          <p>2026 신토플 문제은행</p>
        </div>

        <div className="login-tabs">
          <button
            className={!isSignUp ? "tab active" : "tab"}
            onClick={() => { setIsSignUp(false); setError(""); }}
          >
            로그인
          </button>
          <button
            className={isSignUp ? "tab active" : "tab"}
            onClick={() => { setIsSignUp(true); setError(""); }}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
            />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? "6자 이상 입력" : "비밀번호 입력"}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="submit-btn">
            {isSignUp ? "회원가입" : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}