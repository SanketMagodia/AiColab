"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Section, Task, TaskStatus, User } from "@/lib/types";
import UserBar from "@/components/scrum/UserBar";
import TaskColumn from "@/components/scrum/TaskColumn";
import TaskDrawer from "@/components/scrum/TaskDrawer";
import SectionSelector from "@/components/scrum/SectionSelector";
import Skeleton from "@/components/ui/Skeleton";
import { DnDProvider } from "@/components/scrum/dnd";

const SELECTED_KEY = "teamhub_selected_section";

export default function ScrumPage() {
  const { data: sections = [] } = useSWR<Section[]>("/api/sections", fetcher, { refreshInterval: 5000 });
  const { data: users = [] } = useSWR<User[]>("/api/users", fetcher, { refreshInterval: 5000 });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Restore selected section from localStorage; persists across tabs/devices via section list
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(SELECTED_KEY) : null;
    if (saved) setSelectedId(saved);
  }, []);

  useEffect(() => {
    if (selectedId) localStorage.setItem(SELECTED_KEY, selectedId);
  }, [selectedId]);

  // Auto-pick first section if none selected
  useEffect(() => {
    if (!selectedId && sections.length > 0) setSelectedId(sections[0]._id);
  }, [sections, selectedId]);

  const tasksKey = selectedId ? `/api/tasks?sectionId=${selectedId}` : null;
  const { data: tasks, isLoading } = useSWR<Task[]>(tasksKey, fetcher, { refreshInterval: 5000 });

  const [drawerTask, setDrawerTask] = useState<Partial<Task> | null>(null);

  const grouped = useMemo(() => {
    const g: Record<TaskStatus, Task[]> = { todo: [], inprogress: [], finished: [] };
    (tasks || []).forEach((t) => g[t.status]?.push(t));
    return g;
  }, [tasks]);

  const projects = useMemo(() => {
    const set = new Set<string>();
    (tasks || []).forEach((t) => t.project && set.add(t.project));
    return Array.from(set);
  }, [tasks]);

  async function handleDrop(taskId: string, _from: TaskStatus, to: TaskStatus) {
    if (!tasks) return;
    const t = tasks.find((x) => x._id === taskId);
    if (!t) return;
    // optimistic update
    mutate(tasksKey!, tasks.map((x) => (x._id === taskId ? { ...x, status: to } : x)), false);
    await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...t, status: to }),
    });
    mutate(tasksKey!);
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Task Board</h1>
      </div>

      <UserBar />

      <div className="section-bar">
        <SectionSelector
          sections={sections}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id || null)}
        />
        {selectedId && (
          <button className="btn" onClick={() => setDrawerTask({ sectionId: selectedId })}>
            + Add Task
          </button>
        )}
      </div>

      {!selectedId ? (
        <div className="empty">
          {sections.length === 0
            ? "Create your first section (e.g. Release 7.3) to start tracking tasks."
            : "Select a section above to view its board."}
        </div>
      ) : isLoading ? (
        <div className="scrum-cols">
          <Skeleton height={240} />
          <Skeleton height={240} />
          <Skeleton height={240} />
        </div>
      ) : (
        <DnDProvider onDrop={handleDrop}>
          <div className="scrum-cols">
            <TaskColumn status="todo" label="To Do" tasks={grouped.todo} users={users} onOpen={(t) => setDrawerTask(t)} />
            <TaskColumn status="inprogress" label="In Progress" tasks={grouped.inprogress} users={users} onOpen={(t) => setDrawerTask(t)} />
            <TaskColumn status="finished" label="Finished" tasks={grouped.finished} users={users} onOpen={(t) => setDrawerTask(t)} />
          </div>
        </DnDProvider>
      )}

      <TaskDrawer
        open={!!drawerTask}
        task={drawerTask}
        users={users}
        projects={projects}
        sectionId={selectedId || ""}
        onClose={() => setDrawerTask(null)}
      />
    </div>
  );
}
