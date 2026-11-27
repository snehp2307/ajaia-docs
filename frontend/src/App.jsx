import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api";
import Login from "./pages/Login";
import DocList from "./pages/DocList";
import EditorPage from "./pages/EditorPage";
import AppLayout from "./components/AppLayout";

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

  if (loading) return <div className="center-page muted">Loading…</div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <Routes>
      {/* every signed-in page shares the sidebar layout */}
      <Route element={<AppLayout user={user} onLogout={logout} />}>
        <Route path="/" element={<DocList view="owned" />} />
        <Route path="/shared" element={<DocList view="shared" />} />
        <Route path="/doc/:id" element={<EditorPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
