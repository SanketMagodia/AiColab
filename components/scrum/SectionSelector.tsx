"use client";

import { useState } from "react";
import { mutate } from "swr";
import type { Section } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import { TrashIcon } from "@/components/layout/icons";

type Props = {
  sections: Section[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function SectionSelector({ sections, selectedId, onSelect }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Section | null>(null);
  const toast = useToast();

  async function create() {
    if (!name.trim()) return;
    const res = await fetch("/api/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const created = await res.json();
    setName("");
    setAdding(false);
    mutate("/api/sections");
    if (created._id) onSelect(created._id);
    toast.push("Section created");
  }

  async function remove(s: Section) {
    await fetch(`/api/sections/${s._id}`, { method: "DELETE" });
    mutate("/api/sections");
    if (selectedId === s._id) onSelect("");
    setConfirmDelete(null);
    toast.push("Section deleted");
  }

  return (
    <div className="section-selector">
      <select
        value={selectedId || ""}
        onChange={(e) => onSelect(e.target.value)}
        className="section-dropdown"
      >
        <option value="">— Choose a section —</option>
        {sections.map((s) => (
          <option key={s._id} value={s._id}>{s.name}</option>
        ))}
      </select>

      {selectedId && (
        <button
          className="btn-icon-small"
          onClick={() => {
            const s = sections.find((x) => x._id === selectedId);
            if (s) setConfirmDelete(s);
          }}
          title="Delete section"
        >
          <TrashIcon size={15} />
        </button>
      )}

      {adding ? (
        <div className="inline-add">
          <input
            autoFocus
            placeholder="e.g. Release 7.3"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") { setAdding(false); setName(""); }
            }}
          />
          <button className="btn" onClick={create}>Create</button>
          <button className="btn-secondary" onClick={() => { setAdding(false); setName(""); }}>Cancel</button>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setAdding(true)}>+ New Section</button>
      )}

      <Modal
        open={!!confirmDelete}
        title="Delete section?"
        message={confirmDelete ? `"${confirmDelete.name}" and all its tasks will be deleted.` : ""}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Delete"
      />
    </div>
  );
}
