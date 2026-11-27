import { useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import ListItem from "@tiptap/extension-list-item";
import { api } from "../api";
import Toolbar from "../components/Toolbar";
import ShareDialog from "../components/ShareDialog";
import Avatar from "../components/Avatar";
import { MenuButton } from "../components/AppLayout";

// By default a list item must start with a normal paragraph, so turning a list
// line into a heading kicked it out of the list. Allow headings in list items too.
const ListItemWithHeadings = ListItem.extend({ content: "(paragraph | heading) block*" });

const SAVE_DELAY = 1000; // wait 1s after the last keystroke before saving

// text shown next to the save-status dot ("failed" shows the error message instead)
const STATUS_TEXT = { saved: "Saved", saving: "Saving…", unsaved: "Unsaved changes", conflict: "Not saved" };

export default function EditorPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");
  const { openMenu } = useOutletContext();

  useEffect(() => {
    setDoc(null);
    setError(""); // clear an old error when switching to another document
    api.getDoc(id).then(setDoc).catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <>
        <header className="topbar"><MenuButton onClick={openMenu} /></header>
        <div className="empty-state">
          <h2>{error}</h2>
          <p className="muted">It may have been deleted, or it hasn't been shared with you.</p>
          <Link to="/" className="btn">Back to my documents</Link>
        </div>
      </>
    );
  }
  if (!doc) return <p className="muted loading">Loading document…</p>;

  // key makes React build a fresh editor if we switch to another document
  return <DocEditor key={doc.id} doc={doc} />;
}

function DocEditor({ doc }) {
  const { user, reloadDocs, openMenu } = useOutletContext();
  const canEdit = doc.role !== "viewer";
  const isOwner = doc.role === "owner";
  const [title, setTitle] = useState(doc.title);
  const [status, setStatus] = useState("saved"); // saved | saving | unsaved | conflict | failed
  const [saveError, setSaveError] = useState("");
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
  const savedTitle = useRef(doc.title); // so we only refresh the sidebar when the title changed

  async function save() {
    timer.current = null;
    if (stopped.current) return;
    if (saving.current) {
      saveAgain.current = true; // a save is already running, do another one after it
      return;
    }
    saving.current = true;
    setStatus("saving");
    try {
      const updated = await api.updateDoc(doc.id, {
        version: version.current,
        title: latestTitle.current.trim() || "Untitled document",
        content: latestContent.current,
      });
      version.current = updated.version;
      setStatus("saved");
      if (updated.title !== savedTitle.current) {
        savedTitle.current = updated.title;
        reloadDocs(); // new title should show up in the sidebar
      }
    } catch (err) {
      if (err.status === 409) {
        stopped.current = true;
        setStatus("conflict");
      } else {
        setSaveError(err.message);
        setStatus("failed");
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
    setStatus("unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY);
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ listItem: false }), // replaced by ListItemWithHeadings below
      ListItemWithHeadings,
      Underline,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
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

  // everyone who can open this doc, shown as a row of avatars
  const people = isOwner ? [doc.owner, ...shares.map((s) => s.user)] : [doc.owner, user];

  return (
    <>
      <header className="topbar">
        <MenuButton onClick={openMenu} />
        <Link to={isOwner ? "/" : "/shared"} className="breadcrumb">
          {isOwner ? "My documents" : "Shared with me"}
        </Link>
        <span className="breadcrumb-sep" aria-hidden="true">/</span>
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
        {canEdit
          ? <span className={`save-status ${status}`} role="status">
              {status === "failed" ? `Couldn't save: ${saveError}` : STATUS_TEXT[status]}
            </span>
          : <span className="badge viewer">View only</span>}
        <div className="avatar-stack" aria-label={`People with access: ${people.map((p) => p.name).join(", ")}`}>
          {people.map((p) => <Avatar key={p.id} name={p.name} size={28} />)}
        </div>
        {isOwner
          ? <button className="btn primary small" onClick={() => setShowShare(true)}>Share</button>
          : <span className="muted small-text owner-label">Owned by {doc.owner.name}</span>}
      </header>

      {status === "conflict" && (
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
        <ShareDialog docId={doc.id} shares={shares}
          onChange={(newShares) => { setShares(newShares); reloadDocs(); }}
          onClose={() => setShowShare(false)} />
      )}
    </>
  );
}
