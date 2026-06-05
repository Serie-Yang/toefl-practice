import { NavLink, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-text">TOEFL Practice</span>
        <span className="brand-badge">2026</span>
      </div>

      <div className="navbar-menu">
        <NavLink to="/reading" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          Reading
        </NavLink>
        <NavLink to="/writing" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          Writing
        </NavLink>
        <NavLink to="/speaking" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          Speaking
        </NavLink>
        <NavLink to="/mymenu" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          My Menu
        </NavLink>
      </div>

      <div className="navbar-user">
        <span className="user-email">{user?.email}</span>
        <button onClick={handleLogout} className="logout-btn">로그아웃</button>
      </div>
    </nav>
  );
}