"use client";

import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Note } from "@/lib/types";
import StickyNote from "./StickyNote";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";

const COLORS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#fed7aa", "#99f6e4", "#fecaca"];

export default function NoteCanvas() {
  const { data: notes, isLoading } = useSWR<Note[]>("/api/notes", fetcher, { refreshInterval: 5000 });
  const toast = useToast();

  async function add() {
    const x = Math.random() * 400 + 50;
    const y = Math.random() * 300 + 50;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New note", body: "", color, x, y }),
    });
    mutate("/api/notes");
    toast.push("Note added");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Sticky Notes</h1>
        <button className="btn" onClick={add}>+ Add Note</button>
      </div>
      <div className="notes-canvas">
        {isLoading ? (
          <div style={{ padding: 20 }}><Skeleton height={100} /></div>
        ) : notes && notes.length > 0 ? (
          notes.map((n) => <StickyNote key={n._id} note={n} />)
        ) : (
          <div className="empty" style={{ paddingTop: 80 }}>
            <span className="icon">📝</span>
            No notes yet. Click "Add Note" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
