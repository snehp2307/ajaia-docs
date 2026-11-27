import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function DocList({ user, onLogout }) {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const navigate = useNavigate();

  function loadDocs() {
    api.listDocs().then(setDocs).catch((err) => setError(err.message));
  }

  useEffect(loadDocs, []);

  async function createDoc() {
    setBusy(true);
    try {
      const doc = await api.createDoc("Untitled document");
      navigate(`/doc/${doc.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function importFile(e) {
    const file = e.target.files[0];
    e.target.value = ""; // so picking the same file again still triggers onChange
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const doc = await api.importDoc(file);
      navigate(`/doc/${doc.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function deleteDoc(doc) {
    if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return;
    try {
      await api.deleteDoc(doc.id);
      loadDocs();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <span className="logo">Ajaia Docs</span>
        <span className="spacer" />
        <span className="muted">{user.name}</span>
        <button className="btn small" onClick={onLogout}>Log out</button>
      </header>

      <main className="doc-list">
        <div className="actions">
          <button className="btn primary" onClick={createDoc} disabled={busy}>+ New document</button>
          <button className="btn" onClick={() => fileInput.current.click()} disabled={busy}>Import file</button>
          <input ref={fileInput} type="file" accept=".txt,.md,.docx" hidden onChange={importFile} />
          <span className="muted small-text">Import supports .txt, .md and .docx (max 2 MB)</span>
        </div>

        {error && <p className="error">{error}</p>}
        {!docs && !error && <p className="muted">Loading…</p>}

        {docs && (
          <>
            <h2>My documents</h2>
            {docs.owned.length === 0 && <p className="muted">No documents yet. Create one or import a file.</p>}
            <ul className="doc-rows">
              {docs.owned.map((doc) => (
                <li key={doc.id}>
                  <Link to={`/doc/${doc.id}`} className="doc-title">{doc.title}</Link>
                  <span className="muted">Edited {formatDate(doc.updated_at)}</span>
                  <button className="btn small danger" onClick={() => deleteDoc(doc)}>Delete</button>
                </li>
              ))}
            </ul>

            <h2>Shared with me</h2>
            {docs.shared.length === 0 && <p className="muted">Nothing has been shared with you yet.</p>}
            <ul className="doc-rows">
              {docs.shared.map((doc) => (
                <li key={doc.id}>
                  <Link to={`/doc/${doc.id}`} className="doc-title">{doc.title}</Link>
                  <span className="muted">from {doc.owner.name}</span>
                  <span className={`badge ${doc.role}`}>{doc.role === "editor" ? "Can edit" : "View only"}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
