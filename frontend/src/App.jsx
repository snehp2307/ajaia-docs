import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api";
import Login from "./pages/Login";
import DocList from "./pages/DocList";
import EditorPage from "./pages/EditorPage";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // check if we already have a session cookie
  useEffect(() => {
    api.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await api.logout().catch(() => {});
    setUser(null);
  }

  if (loading) return <div className="center-page">Loading…</div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <Routes>
      <Route path="/" element={<DocList user={user} onLogout={logout} />} />
      <Route path="/doc/:id" element={<EditorPage user={user} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
