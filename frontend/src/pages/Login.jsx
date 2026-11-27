import { useState } from "react";
import { api } from "../api";

const DEMO_USERS = [
  { email: "alice@ajaia.test", name: "Alice" },
  { email: "bob@ajaia.test", name: "Bob" },
  { email: "carol@ajaia.test", name: "Carol" },
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onLogin(await api.login(email, password));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>Ajaia Docs</h1>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>

        <div className="demo-users">
          <p>Demo accounts (password <code>demo1234</code>):</p>
          {DEMO_USERS.map((u) => (
            <button type="button" key={u.email} className="btn small"
              onClick={() => { setEmail(u.email); setPassword("demo1234"); }}>
              {u.name}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
