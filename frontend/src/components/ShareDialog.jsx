import { useEffect, useState } from "react";
import { api } from "../api";

export default function ShareDialog({ docId, shares, onChange, onClose }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [people, setPeople] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.users().then(setPeople).catch(() => {});
  }, []);

  // close on Escape
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(action) {
    setError("");
    setBusy(true);
    try {
      const doc = await action();
      onChange(doc.shares);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleShare(e) {
    e.preventDefault();
    if (await run(() => api.share(docId, email, role))) {
      setEmail("");
      setRole("viewer"); // reset so the next person doesn't get edit access by accident
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label="Share document" onClick={(e) => e.stopPropagation()}>
        <h2>Share document</h2>

        <form className="share-form" onSubmit={handleShare}>
          <input type="email" placeholder="Email address" value={email} list="people"
            onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <datalist id="people">
            {people.map((p) => <option key={p.id} value={p.email}>{p.name}</option>)}
          </datalist>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="viewer">Can view</option>
            <option value="editor">Can edit</option>
          </select>
          <button className="btn primary" disabled={busy}>Share</button>
        </form>
        {error && <p className="error">{error}</p>}

        <h3>People with access</h3>
        {shares.length === 0 && <p className="muted">Only you can see this document.</p>}
        <ul className="share-list">
          {shares.map((s) => (
            <li key={s.user.id}>
              <span>{s.user.name} <span className="muted">{s.user.email}</span></span>
              <select value={s.role} disabled={busy}
                onChange={(e) => run(() => api.share(docId, s.user.email, e.target.value))}>
                <option value="viewer">Can view</option>
                <option value="editor">Can edit</option>
              </select>
              <button className="btn small danger" disabled={busy}
                onClick={() => run(() => api.unshare(docId, s.user.id))}>Remove</button>
            </li>
          ))}
        </ul>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
