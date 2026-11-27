// formatting buttons for the TipTap editor

// small inline SVG icons (paths from the Lucide icon set) so they look the same on every OS
const icons = {
  bulletList: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  orderedList: "M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1",
  quote: "M3 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .01-1 1.03V20c0 1 0 1 1 1zM15 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
  undo: "M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13",
  redo: "M21 7v6h-6M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7",
};

function Icon({ name }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}

function ToolButton({ label, title, active, onClick }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active === undefined ? undefined : active}
      className={active ? "tool active" : "tool"}
      // onMouseDown + preventDefault keeps the text selection in the editor
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      // keyboard users press Enter/Space, which fires click instead of mousedown
      onClick={(e) => { if (e.detail === 0) onClick(); }}
    >
      {label}
    </button>
  );
}

export default function Toolbar({ editor }) {
  if (!editor) return null;
  const chain = () => editor.chain().focus();

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
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
      <ToolButton label={<Icon name="bulletList" />} title="Bulleted list" active={editor.isActive("bulletList")}
        onClick={() => chain().toggleBulletList().run()} />
      <ToolButton label={<Icon name="orderedList" />} title="Numbered list" active={editor.isActive("orderedList")}
        onClick={() => chain().toggleOrderedList().run()} />
      <ToolButton label={<Icon name="quote" />} title="Quote" active={editor.isActive("blockquote")}
        onClick={() => chain().toggleBlockquote().run()} />
      <span className="divider" />
      <ToolButton label={<Icon name="undo" />} title="Undo (Ctrl+Z)" onClick={() => chain().undo().run()} />
      <ToolButton label={<Icon name="redo" />} title="Redo (Ctrl+Y)" onClick={() => chain().redo().run()} />
    </div>
  );
}
