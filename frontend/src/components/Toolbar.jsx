// formatting buttons for the TipTap editor

function ToolButton({ label, title, active, onClick }) {
  return (
    <button
      type="button"
      title={title}
      className={active ? "tool active" : "tool"}
      // onMouseDown + preventDefault keeps the text selection in the editor
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    >
      {label}
    </button>
  );
}

export default function Toolbar({ editor }) {
  if (!editor) return null;
  const chain = () => editor.chain().focus();

  return (
    <div className="toolbar">
      <ToolButton label={<b>B</b>} title="Bold (Ctrl+B)" active={editor.isActive("bold")}
        onClick={() => chain().toggleBold().run()} />
      <ToolButton label={<i>I</i>} title="Italic (Ctrl+I)" active={editor.isActive("italic")}
        onClick={() => chain().toggleItalic().run()} />
      <ToolButton label={<u>U</u>} title="Underline (Ctrl+U)" active={editor.isActive("underline")}
        onClick={() => chain().toggleUnderline().run()} />
      <span className="divider" />
      <ToolButton label="Text" title="Normal text" active={editor.isActive("paragraph")}
        onClick={() => chain().setParagraph().run()} />
      <ToolButton label="H1" title="Heading 1" active={editor.isActive("heading", { level: 1 })}
        onClick={() => chain().toggleHeading({ level: 1 }).run()} />
      <ToolButton label="H2" title="Heading 2" active={editor.isActive("heading", { level: 2 })}
        onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <ToolButton label="H3" title="Heading 3" active={editor.isActive("heading", { level: 3 })}
        onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <span className="divider" />
      <ToolButton label="• List" title="Bulleted list" active={editor.isActive("bulletList")}
        onClick={() => chain().toggleBulletList().run()} />
      <ToolButton label="1. List" title="Numbered list" active={editor.isActive("orderedList")}
        onClick={() => chain().toggleOrderedList().run()} />
      <ToolButton label="❝" title="Quote" active={editor.isActive("blockquote")}
        onClick={() => chain().toggleBlockquote().run()} />
      <span className="divider" />
      <ToolButton label="↶" title="Undo (Ctrl+Z)" onClick={() => chain().undo().run()} />
      <ToolButton label="↷" title="Redo (Ctrl+Y)" onClick={() => chain().redo().run()} />
    </div>
  );
}
