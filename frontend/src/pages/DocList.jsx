import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../api";
import Avatar from "../components/Avatar";
import { MenuButton } from "../components/AppLayout";

// "5 min ago", "yesterday", or a date for older things
function timeAgo(iso) {
  if (!iso) return "";
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 172800) return "yesterday";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function DocList({ view }) {
  const { user, docs, reloadDocs, createDoc, openImport, openMenu } = useOutletContext();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const isShared = view === "shared";
  const title = isShared ? "Shared with me" : "My documents";
  const all = docs ? (isShared ? docs.shared : docs.owned) : null;
  const shown = all ? all.filter((d) => d.title.toLowerCase().includes(search.trim().toLowerCase())) : null;

  async function deleteDoc(doc) {
    if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return;
    setError("");
    try {
      await api.deleteDoc(doc.id);
      reloadDocs();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <header className="topbar">
        <MenuButton onClick={openMenu} />
        <h1 className="page-title">{title}</h1>
        <span className="spacer" />
        <input
          type="search"
          className="search"
          placeholder="Search by title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search documents by title"
        />
      </header>

      <main className="doc-list">
        {error && <p className="error" role="alert">{error}</p>}
        {!docs && <p className="muted">Loading…</p>}

        {all && all.length === 0 && (
          <div className="empty-state">
            {isShared ? (
              <>
                <h2>Nothing shared with you yet</h2>
                <p className="muted">When a teammate shares a document with {user.email}, it shows up here.</p>
              </>
            ) : (
              <>
                <h2>No documents yet</h2>
                <p className="muted">Start a blank document or import a .txt, .md or .docx file.</p>
                <div className="empty-actions">
                  <button className="btn primary" onClick={createDoc}>+ New document</button>
                  <button className="btn" onClick={openImport}>Import file</button>
                </div>
              </>
            )}
          </div>
        )}

        {all && all.length > 0 && (
          <div className="doc-table" role="table" aria-label={title}>
            <div className="doc-row doc-head" role="row">
              <span role="columnheader">Name</span>
              <span role="columnheader">{isShared ? "Owner" : "Shared"}</span>
              <span role="columnheader">Last edited</span>
              <span role="columnheader" className="cell-end">{isShared ? "Access" : ""}</span>
            </div>

            {shown.length === 0 && <p className="muted no-results">No documents match "{search}".</p>}

            {shown.map((doc) => (
              <div className="doc-row" role="row" key={doc.id}>
                <Link to={`/doc/${doc.id}`} className="doc-title" role="cell">
                  <DocIcon /> <span className="truncate">{doc.title}</span>
                </Link>
                <span role="cell" className="cell-owner">
                  {isShared
                    ? <><Avatar name={doc.owner.name} size={22} /> {doc.owner.name}</>
                    : <span className="muted">{doc.share_count ? `${doc.share_count} ${doc.share_count === 1 ? "person" : "people"}` : "Only you"}</span>}
                </span>
                <span role="cell" className="muted cell-time">{timeAgo(doc.updated_at)}</span>
                <span role="cell" className="cell-end">
                  {isShared
                    ? <span className={`badge ${doc.role}`}>{doc.role === "editor" ? "Can edit" : "View only"}</span>
                    : <button className="btn small danger" onClick={() => deleteDoc(doc)}>Delete</button>}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="doc-icon">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}
