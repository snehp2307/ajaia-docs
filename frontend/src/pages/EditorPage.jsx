import { useEffect, useState } from "react";
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
import useAutosave from "../useAutosave";

// By default a list item must start with a normal paragraph, so turning a list
// line into a heading kicked it out of the list. Allow headings in list items too.
const ListItemWithHeadings = ListItem.extend({ content: "(paragraph | heading) block*" });

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
  const [showShare, setShowShare] = useState(false);
  const [shares, setShares] = useState(doc.shares || []);
  // a renamed doc should show its new title in the sidebar
  const { status, saveError, queueSave } = useAutosave(doc, reloadDocs);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ listItem: false }), // replaced by ListItemWithHeadings below
      ListItemWithHeadings,
      Underline,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: doc.content,
    editable: canEdit,
    onUpdate: ({ editor }) => queueSave({ content: editor.getHTML() }),
  });

  // After a conflict the user's unsaved text is still in the editor. Copy it with
  // formatting (falls back to plain text in browsers without rich clipboard support).
  const [copied, setCopied] = useState(false);
  async function copyMyVersion() {
    const html = editor.getHTML();
    const text = editor.getText();
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      })]);
    } catch {
      await navigator.clipboard.writeText(text);
    }
    setCopied(true);
  }

  function onTitleChange(e) {
    setTitle(e.target.value);
    queueSave({ title: e.target.value });
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
          // an empty title is saved as "Untitled document", so show that too
          onBlur={() => { if (!title.trim()) setTitle("Untitled document"); }}
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
        <div className="banner" role="alert">
          Someone else saved this document while you were editing, so your latest changes were not saved.
          Copy your version first, then reload and paste back what you need.
          <button className="btn small" onClick={copyMyVersion}>{copied ? "Copied" : "Copy my version"}</button>
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
