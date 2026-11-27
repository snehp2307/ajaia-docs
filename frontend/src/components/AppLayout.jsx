import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import Avatar from "./Avatar";

// The app shell: sidebar on the left, the current page on the right.
// It also owns the document list, so the sidebar and pages share one copy of it.
export default function AppLayout({ user, onLogout }) {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // sidebar drawer on phones
  const fileInput = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  function reloadDocs() {
    return api.listDocs().then(setDocs).catch((err) => setError(err.message));
  }

  useEffect(() => { reloadDocs(); }, []);

  // close the phone drawer whenever we go to another page
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  async function createDoc() {
    setBusy(true);
    setError("");
    try {
      const doc = await api.createDoc("Untitled document");
      await reloadDocs();
      navigate(`/doc/${doc.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(e) {
    const file = e.target.files[0];
    e.target.value = ""; // so picking the same file again still triggers onChange
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const doc = await api.importDoc(file);
      await reloadDocs();
      navigate(`/doc/${doc.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // most recently edited documents, mine and shared, for quick switching
  const recent = docs
    ? [...docs.owned, ...docs.shared].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")).slice(0, 8)
    : [];

  const context = {
    user,
    docs,
    reloadDocs,
    createDoc,
    openImport: () => fileInput.current.click(),
    openMenu: () => setMenuOpen(true),
  };

  return (
    <div className="app">
      <aside className={menuOpen ? "sidebar open" : "sidebar"} aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-mark">A</span> Ajaia Docs
        </div>

        <div className="sidebar-actions">
          <button className="btn primary block" onClick={createDoc} disabled={busy}>+ New document</button>
          <button className="btn block" onClick={context.openImport} disabled={busy}>Import file</button>
          <input ref={fileInput} type="file" accept=".txt,.md,.docx" hidden onChange={importFile} />
          <p className="hint">.txt, .md or .docx, up to 2 MB</p>
          {error && <p className="error small-text" role="alert">{error}</p>}
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className="nav-item">
            My documents <span className="count">{docs ? docs.owned.length : ""}</span>
          </NavLink>
          <NavLink to="/shared" className="nav-item">
            Shared with me <span className="count">{docs ? docs.shared.length : ""}</span>
          </NavLink>
        </nav>

        {recent.length > 0 && (
          <>
            <div className="sidebar-heading">Recent</div>
            <nav className="sidebar-recent">
              {recent.map((doc) => (
                <NavLink key={doc.id} to={`/doc/${doc.id}`} className="nav-item recent-item" title={doc.title}>
                  <span className="truncate">{doc.title}</span>
                  {doc.role && <span className="shared-dot" title="Shared with you" />}
                </NavLink>
              ))}
            </nav>
          </>
        )}

        <div className="sidebar-footer">
          <Avatar name={user.name} size={32} />
          <div className="account">
            <div className="truncate account-name">{user.name}</div>
            <div className="truncate muted small-text">{user.email}</div>
          </div>
          <button className="btn small" onClick={onLogout}>Log out</button>
        </div>
      </aside>

      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <Outlet context={context} />
      </div>
    </div>
  );
}

// hamburger button shown in page headers on small screens
export function MenuButton({ onClick }) {
  return (
    <button className="btn small menu-button" onClick={onClick} aria-label="Open menu">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
  );
}
