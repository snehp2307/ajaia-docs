import { useEffect, useRef, useState } from "react";
import { api } from "./api";

const SAVE_DELAY = 1000; // wait 1s after the last change before saving

// Autosave for one document.
//
// Call queueSave({ title }) or queueSave({ content }) whenever something changes.
// One second after the last change we send the whole document with the version we
// last saw. Rules:
//   - only one save request at a time; changes made during a save trigger one more save after it
//   - if the server says someone else saved first (409), stop saving so we never overwrite them
//   - if the user leaves the page with a save still waiting, send it right away
//
// status is one of: saved | unsaved | saving | conflict | failed
export default function useAutosave(doc, onTitleSaved) {
  const [status, setStatus] = useState("saved");
  const [saveError, setSaveError] = useState("");

  // refs, not state: these change on every keystroke and the save code needs
  // the latest values, but changing them shouldn't re-render the page
  const latest = useRef({ title: doc.title, content: doc.content });
  const version = useRef(doc.version);
  const savedTitle = useRef(doc.title);
  const timer = useRef(null);
  const saving = useRef(false);
  const saveAgain = useRef(false);
  const stopped = useRef(false);

  async function save() {
    timer.current = null;
    if (stopped.current) return;
    if (saving.current) {
      saveAgain.current = true;
      return;
    }

    saving.current = true;
    setStatus("saving");
    try {
      const updated = await api.updateDoc(doc.id, {
        version: version.current,
        title: latest.current.title.trim() || "Untitled document",
        content: latest.current.content,
      });
      version.current = updated.version;
      setStatus("saved");
      if (updated.title !== savedTitle.current) {
        savedTitle.current = updated.title;
        onTitleSaved();
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

  function queueSave(changes) {
    latest.current = { ...latest.current, ...changes };
    setStatus("unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY);
  }

  useEffect(() => {
    // browser shows "leave site?" if a save hasn't finished
    function warnIfUnsaved(e) {
      if (timer.current || saving.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", warnIfUnsaved);

    return () => {
      window.removeEventListener("beforeunload", warnIfUnsaved);
      // leaving the page inside the app (e.g. clicking the sidebar): flush the pending save
      if (timer.current) {
        clearTimeout(timer.current);
        save();
      }
    };
  }, []);

  return { status, saveError, queueSave };
}
