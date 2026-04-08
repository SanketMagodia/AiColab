"use client";

import { useEffect, useState } from "react";
import { mutate } from "swr";
import type { Task, TaskStatus, User } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";

type Props = {
  open: boolean;
  task: Partial<Task> | null;
  users: User[];
  projects: string[];
  sectionId: string;
  onClose: () => void;
};

export default function TaskDrawer({ open, task, users, projects, sectionId, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const isEdit = !!(task && task._id);

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setProject(task.project || "");
      setAssignedUserId(task.assignedUserId || null);
      setStatus((task.status as TaskStatus) || "todo");
    }
  }, [task]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !task) return null;

  async function save() {
    if (!title.trim()) return;
    if (isEdit) {
      await fetch(`/api/tasks/${task!._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description, project, assignedUserId, status, sectionId }),
      });
      toast.push("Task updated");
    } else {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description, project, assignedUserId, sectionId }),
      });
      toast.push("Task created");
    }
    mutate(`/api/tasks?sectionId=${sectionId}`);
    onClose();
  }

  async function remove() {
    if (!task?._id) return;
    await fetch(`/api/tasks/${task._id}`, { method: "DELETE" });
    mutate(`/api/tasks?sectionId=${sectionId}`);
    toast.push("Task deleted");
    setConfirmDelete(false);
    onClose();
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <h2>{isEdit ? "Edit Task" : "New Task"}</h2>
        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </div>
        <div className="field">
          <label>Project</label>
          <input value={project} list="project-list" onChange={(e) => setProject(e.target.value)} />
          <datalist id="project-list">
            {projects.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>
        <div className="field">
          <label>Assigned User</label>
          <select value={assignedUserId || ""} onChange={(e) => setAssignedUserId(e.target.value || null)}>
            <option value="">— Unassigned —</option>
            {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        </div>
        {isEdit && (
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="todo">Todo</option>
              <option value="inprogress">In Progress</option>
              <option value="finished">Finished</option>
            </select>
          </div>
        )}
        <div className="drawer-actions">
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={save}>Save</button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
          {isEdit && <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>}
        </div>
      </div>
      <Modal
        open={confirmDelete}
        title="Delete task?"
        message="This action cannot be undone."
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
        confirmLabel="Delete"
      />
    </>
  );
}
