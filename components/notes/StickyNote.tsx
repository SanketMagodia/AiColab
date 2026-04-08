"use client";

import { useRef, useState } from "react";
import Draggable, { DraggableEvent, DraggableData } from "react-draggable";
import type { Note } from "@/lib/types";
import { mutate } from "swr";
import { useToast } from "@/hooks/useToast";

const COLORS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#fed7aa", "#99f6e4", "#fecaca"];

export default function StickyNote({ note }: { note: Note }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const toast = useToast();

  async function update(patch: Partial<Note>) {
    await fetch(`/api/notes/${note._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...note, ...patch }),
    });
    mutate("/api/notes");
  }

  async function remove() {
    await fetch(`/api/notes/${note._id}`, { method: "DELETE" });
    mutate("/api/notes");
    toast.push("Note deleted");
  }

  function onStop(_e: DraggableEvent, data: DraggableData) {
    if (data.x !== note.x || data.y !== note.y) {
      update({ x: data.x, y: data.y });
    }
  }

  return (
    <Draggable nodeRef={nodeRef} defaultPosition={{ x: note.x, y: note.y }} onStop={onStop} cancel=".no-drag">
      <div ref={nodeRef} className="sticky-note" style={{ background: note.color }}>
        <div
          ref={titleRef}
          className="note-title no-drag"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const v = e.currentTarget.textContent || "";
            if (v !== note.title) update({ title: v });
          }}
        >
          {note.title}
        </div>
        <div
          ref={bodyRef}
          className="note-body no-drag"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const v = e.currentTarget.textContent || "";
            if (v !== note.body) update({ body: v });
          }}
        >
          {note.body}
        </div>
        <div className="note-toolbar no-drag">
          <button className="swatch" style={{ background: note.color }} onClick={() => setPickerOpen((p) => !p)} title="Color" />
          {pickerOpen && COLORS.map((c) => (
            <button
              key={c}
              className="swatch"
              style={{ background: c }}
              onClick={() => { update({ color: c }); setPickerOpen(false); }}
            />
          ))}
          <button className="x-btn" onClick={remove} title="Delete">×</button>
        </div>
      </div>
    </Draggable>
  );
}
