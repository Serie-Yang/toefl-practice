import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Reading from "./pages/Reading";
import Writing from "./pages/Writing";
import Speaking from "./pages/Speaking";
import MyMenu from "./pages/MyMenu";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main className="main-content">
        {children}
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <PrivateRoute>
              <Layout><Navigate to="/reading" /></Layout>
            </PrivateRoute>
          } />
          <Route path="/reading" element={
            <PrivateRoute>
              <Layout><Reading /></Layout>
            </PrivateRoute>
          } />
          <Route path="/writing" element={
            <PrivateRoute>
              <Layout><Writing /></Layout>
            </PrivateRoute>
          } />
          <Route path="/speaking" element={
            <PrivateRoute>
              <Layout><Speaking /></Layout>
            </PrivateRoute>
          } />
          <Route path="/mymenu" element={
            <PrivateRoute>
              <Layout><MyMenu /></Layout>
            </PrivateRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}