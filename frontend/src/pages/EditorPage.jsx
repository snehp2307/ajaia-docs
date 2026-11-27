import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { api } from "../api";
import Toolbar from "../components/Toolbar";
import ShareDialog from "../components/ShareDialog";

const SAVE_DELAY = 1000; // wait 1s after the last keystroke before saving

export default function EditorPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setDoc(null);
    api.getDoc(id).then(setDoc).catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="center-page">
        <div className="card">
          <p className="error">{error}</p>
          <Link to="/" className="btn">Back to documents</Link>
        </div>
      </div>
    );
  }
  if (!doc) return <div className="center-page">Loading document…</div>;

  // key makes React build a fresh editor if we switch to another document
  return <DocEditor key={doc.id} doc={doc} />;
}

function DocEditor({ doc }) {
  const canEdit = doc.role !== "viewer";
  const [title, setTitle] = useState(doc.title);
  const [status, setStatus] = useState("Saved");
  const [conflict, setConflict] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shares, setShares] = useState(doc.shares || []);

  // refs hold the latest values without causing re-renders
  const version = useRef(doc.version);
  const latestTitle = useRef(doc.title);
  const latestContent = useRef(doc.content);
  const timer = useRef(null);
  const saving = useRef(false);
  const saveAgain = useRef(false);
  const stopped = useRef(false); // set after a conflict so we stop overwriting

  async function save() {
    timer.current = null;
    if (stopped.current) return;
    if (saving.current) {
      saveAgain.current = true; // a save is already running, do another one after it
      return;
    }
    saving.current = true;
    setStatus("Saving…");
    try {
      const updated = await api.updateDoc(doc.id, {
        version: version.current,
        title: latestTitle.current.trim() || "Untitled document",
        content: latestContent.current,
      });
      version.current = updated.version;
      setStatus("Saved");
    } catch (err) {
      if (err.status === 409) {
        stopped.current = true;
        setConflict(true);
        setStatus("Not saved");
      } else {
        setStatus("Couldn't save: " + err.message);
      }
    } finally {
      saving.current = false;
      if (saveAgain.current) {
        saveAgain.current = false;
        save();
      }
    }
  }

  function scheduleSave() {
    setStatus("Unsaved changes");
    clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY);
  }

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: doc.content,
    editable: canEdit,
    onUpdate: ({ editor }) => {
      latestContent.current = editor.getHTML();
      scheduleSave();
    },
  });

  // if the user leaves with a save still waiting, send it right away
  useEffect(() => {
    function warnIfUnsaved(e) {
      if (timer.current || saving.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", warnIfUnsaved);
    return () => {
      window.removeEventListener("beforeunload", warnIfUnsaved);
      if (timer.current) {
        clearTimeout(timer.current);
        save();
      }
    };
  }, []);

  function onTitleChange(e) {
    setTitle(e.target.value);
    latestTitle.current = e.target.value;
    scheduleSave();
  }

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="btn small">← Documents</Link>
        <input
          className="title-input"
          value={title}
          onChange={onTitleChange}
          onBlur={() => {
            if (!title.trim()) {
              setTitle("Untitled document");
              latestTitle.current = "Untitled document";
            }
          }}
          maxLength={200}
          disabled={!canEdit}
          aria-label="Document title"
        />
        <span className="spacer" />
        {canEdit ? <span className="muted save-status">{status}</span> : <span className="badge viewer">View only</span>}
        {doc.role === "owner" && <button className="btn primary small" onClick={() => setShowShare(true)}>Share</button>}
        {doc.role !== "owner" && <span className="muted">Owner: {doc.owner.name}</span>}
      </header>

      {conflict && (
        <div className="banner">
          Someone else saved this document while you were editing, so your last changes were not saved.
          <button className="btn small" onClick={() => window.location.reload()}>Reload latest version</button>
        </div>
      )}

      {canEdit && <Toolbar editor={editor} />}
      <main className="paper">
        <EditorContent editor={editor} />
      </main>

      {showShare && (
        <ShareDialog docId={doc.id} shares={shares} onChange={setShares} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
