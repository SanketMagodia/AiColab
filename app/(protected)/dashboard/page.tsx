"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import { MS_SCOPES, getMsal, getRedirectResult, graphFetch, graphBlob } from "@/lib/msal";
import { SparklesIcon, CheckCircleIcon, CalendarIcon, CheckIcon, XIcon, WandIcon, RefreshIcon } from "@/components/layout/icons";

/* ── types ── */
type Email = {
  id: string; subject: string; bodyPreview: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime: string; isRead: boolean;
};
type CalEvent = { id: string; subject: string; start: { dateTime: string }; end: { dateTime: string } };
type TodoList = { id: string; displayName: string };
type TodoTask = { id: string; title: string; status: string; dueDateTime?: { dateTime: string }; listId: string; listName: string };
type Chat = {
  id: string; topic?: string;
  lastMessagePreview?: { id?: string; createdDateTime?: string; body?: { content?: string }; from?: { user?: { displayName?: string } } };
};
type Profile = { displayName?: string; userPrincipalName?: string; mail?: string; givenName?: string };
type GraphUser = { id: string; displayName: string; mail?: string; userPrincipalName?: string; jobTitle?: string };

/* ── helpers ── */
const fmtTime = (s?: string) => s ? new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "";
const ini = (n?: string) => n ? n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";
function relTime(s: string) {
  const d = new Date(s).getTime() - Date.now();
  if (d <= 0) return "now";
  const m = Math.floor(d / 60000), h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}
function greet() {
  const h = new Date().getHours();
  if (h < 5) return "Working late"; if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon"; if (h < 21) return "Good evening"; return "Good night";
}

const HIGHLIGHT = ["sanket", "sanketmagodia"];
// Only highlight when someone ELSE mentions the user — pass the sender name to exclude self
const isHL = (t?: string, sender?: string) => {
  if (!t) return false;
  // If the sender is the logged-in user, don't highlight
  if (sender && HIGHLIGHT.some(h => sender.toLowerCase().includes(h))) return false;
  return HIGHLIGHT.some(h => t.toLowerCase().includes(h));
};
const POLL = 60_000;

/* ══════════════════════════════════════ */
export default function DashboardPage() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [initError, setInitError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatar, setAvatar] = useState("");
  const [connected, setConnected] = useState(true);

  const [emails, setEmails] = useState<Email[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [lists, setLists] = useState<TodoList[]>([]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [emailBodies, setEmailBodies] = useState<Record<string, string>>({});
  const [showCalForm, setShowCalForm] = useState(false);
  const [evtName, setEvtName] = useState(""); const [evtStart, setEvtStart] = useState(""); const [evtEnd, setEvtEnd] = useState("");
  const [newTitle, setNewTitle] = useState(""); const [newDue, setNewDue] = useState(""); const [newListId, setNewListId] = useState("");
  const [replyChat, setReplyChat] = useState<string | null>(null);
  const [replyText, setReplyText] = useState(""); const [replying, setReplying] = useState(false);

  // send-to-person
  const [dmOpen, setDmOpen] = useState(false);
  const [dmQuery, setDmQuery] = useState("");
  const [dmResults, setDmResults] = useState<GraphUser[]>([]);
  const [dmTarget, setDmTarget] = useState<GraphUser | null>(null);
  const [dmMsg, setDmMsg] = useState("");
  const [dmSearching, setDmSearching] = useState(false);
  const [dmSending, setDmSending] = useState(false);
  const searchTimer = useRef<number | null>(null);
  const [leftTab, setLeftTab] = useState<"teams" | "inbox">("teams");

  // AI insights
  type AIAction =
    | { type: "task"; title: string; due?: string; source: string; reason: string }
    | { type: "event"; title: string; start: string; end: string; source: string; reason: string };
  const [aiSummary, setAiSummary] = useState("");
  const [aiActions, setAiActions] = useState<AIAction[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiDismissed, setAiDismissed] = useState<Set<number>>(new Set());
  const [aiAccepting, setAiAccepting] = useState<number | null>(null);

  const [tick, setTick] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().split("T")[0]);
  const seenEmails = useRef(new Set<string>());
  const seenEvents = useRef(new Set<string>());
  const seenChats = useRef(new Set<string>());
  const firstLoad = useRef({ email: true, cal: true, tasks: true, chat: true });

  /* ── notifications ── */
  const notify = useCallback((title: string, body: string) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = "sine";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.3);
    } catch { /* noop */ }
    if ("Notification" in window && Notification.permission === "granted")
      new Notification(title, { body });
  }, []);

  /* ── MSAL init (redirect flow) ── */
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const pca = await getMsal();
        if (dead) return;
        const result = getRedirectResult();
        if (result?.account) { setAccount(result.account); return; }
        const accs = pca.getAllAccounts();
        if (accs.length) setAccount(accs[0]);
      } catch (e) { if (!dead) setInitError(e instanceof Error ? e.message : "Init failed"); }
    })();
    return () => { dead = true; };
  }, []);

  async function signIn() {
    try {
      const pca = await getMsal();
      await pca.loginRedirect({ scopes: MS_SCOPES });
    } catch { /* page navigates away */ }
  }

  async function signOut() {
    try {
      const pca = await getMsal();
      const acc = account;
      setAccount(null); setProfile(null);
      setEmails([]); setEvents([]); setTasks([]); setLists([]); setChats([]);
      if (acc) await pca.logoutRedirect({ account: acc, postLogoutRedirectUri: window.location.origin + "/dashboard" });
    } catch { /* noop */ }
  }

  /* ── loaders ── */
  const loadProfile = useCallback(async (a: AccountInfo) => {
    try {
      const me = await graphFetch<Profile>(a, "/me?$select=displayName,userPrincipalName,mail,givenName");
      setProfile(me); setConnected(true);
      const blob = await graphBlob(a, "/me/photo/$value");
      if (blob) setAvatar(URL.createObjectURL(blob));
    } catch { /* non-critical */ }
  }, []);

  const loadEmails = useCallback(async (a: AccountInfo) => {
    try {
      const d = await graphFetch<{ value: Email[] }>(a,
        "/me/mailFolders/inbox/messages?$top=30&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,receivedDateTime,isRead");
      const msgs = d?.value ?? [];
      msgs.forEach(m => { if (!seenEmails.current.has(m.id)) { if (!firstLoad.current.email) notify("New Email", `${m.from?.emailAddress?.name}: ${m.subject}`); seenEmails.current.add(m.id); } });
      firstLoad.current.email = false;
      setEmails(msgs); setConnected(true); setErrs(e => ({ ...e, email: "" }));
    } catch (e) { setErrs(p => ({ ...p, email: e instanceof Error ? e.message : "Failed" })); setConnected(false); }
  }, [notify]);

  const loadCalendar = useCallback(async (a: AccountInfo) => {
    try {
      const now = new Date();
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const e2 = new Date(s); e2.setDate(e2.getDate() + 8);
      const d = await graphFetch<{ value: CalEvent[] }>(a,
        `/me/calendarView?startDateTime=${s.toISOString()}&endDateTime=${e2.toISOString()}&$top=50&$orderby=start/dateTime&$select=id,subject,start,end`);
      const evs = d?.value ?? [];
      evs.forEach(ev => { if (!seenEvents.current.has(ev.id)) { if (!firstLoad.current.cal) notify("New Event", ev.subject); seenEvents.current.add(ev.id); } });
      firstLoad.current.cal = false;
      setEvents(evs); setErrs(p => ({ ...p, cal: "" }));
    } catch (e) { setErrs(p => ({ ...p, cal: e instanceof Error ? e.message : "Failed" })); }
  }, [notify]);

  const loadTasks = useCallback(async (a: AccountInfo) => {
    try {
      const ld = await graphFetch<{ value: TodoList[] }>(a, "/me/todo/lists?$top=20");
      const ls = ld?.value ?? []; setLists(ls);
      setNewListId(cur => cur || ls[0]?.id || "");
      const all: TodoTask[] = [];
      for (const l of ls) {
        const td = await graphFetch<{ value: Omit<TodoTask, "listId" | "listName">[] }>(a,
          `/me/todo/lists/${l.id}/tasks?$top=50&$filter=status ne 'completed'`);
        (td?.value ?? []).forEach(t => all.push({ ...t, listId: l.id, listName: l.displayName }));
      }
      firstLoad.current.tasks = false;
      setTasks(all); setErrs(p => ({ ...p, tasks: "" }));
    } catch (e) { setErrs(p => ({ ...p, tasks: e instanceof Error ? e.message : "Failed" })); }
  }, []);

  const loadChats = useCallback(async (a: AccountInfo) => {
    try {
      const d = await graphFetch<{ value: Chat[] }>(a,
        "/me/chats?$top=20&$expand=lastMessagePreview&$orderby=lastMessagePreview/createdDateTime desc");
      const cs = (d?.value ?? []).filter(c => c.lastMessagePreview);
      cs.forEach(c => {
        const mid = c.lastMessagePreview!.id || c.id;
        if (!seenChats.current.has(mid)) { if (!firstLoad.current.chat) notify("New Chat", c.lastMessagePreview!.from?.user?.displayName || ""); seenChats.current.add(mid); }
      });
      firstLoad.current.chat = false;
      setChats(cs); setErrs(p => ({ ...p, chat: "" }));
    } catch (e) { setErrs(p => ({ ...p, chat: e instanceof Error ? e.message : "Failed" })); }
  }, [notify]);

  const refreshAll = useCallback((a: AccountInfo) => { loadEmails(a); loadCalendar(a); loadTasks(a); loadChats(a); }, [loadEmails, loadCalendar, loadTasks, loadChats]);

  useEffect(() => {
    if (!account) return;
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    loadProfile(account);
    refreshAll(account);
    const ids = [
      window.setInterval(() => loadEmails(account), POLL),
      window.setInterval(() => loadCalendar(account), POLL),
      window.setInterval(() => loadTasks(account), POLL),
      window.setInterval(() => loadChats(account), POLL),
      window.setInterval(() => setTick(t => t + 1), 30_000),
    ];
    return () => ids.forEach(clearInterval);
  }, [account, loadProfile, refreshAll, loadEmails, loadCalendar, loadTasks, loadChats]);

  /* ── actions ── */
  async function openEmail(id: string, wasUnread: boolean) {
    setExpandedEmail(id);
    if (!emailBodies[id] && account) {
      try {
        const msg = await graphFetch<{ body?: { content?: string; contentType?: string } }>(account, `/me/messages/${id}?$select=body`);
        setEmailBodies(b => ({ ...b, [id]: msg?.body?.content || "<p>(no body)</p>" }));
        if (wasUnread) {
          await graphFetch(account, `/me/messages/${id}`, { method: "PATCH", body: JSON.stringify({ isRead: true }) });
          setEmails(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
        }
      } catch (e) { setEmailBodies(b => ({ ...b, [id]: `<p>Error: ${e instanceof Error ? e.message : "failed"}</p>` })); }
    }
  }

  async function addEvent() {
    if (!account || !evtName.trim() || !evtStart || !evtEnd) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      await graphFetch(account, "/me/events", { method: "POST", body: JSON.stringify({ subject: evtName.trim(), start: { dateTime: evtStart, timeZone: tz }, end: { dateTime: evtEnd, timeZone: tz } }) });
      setEvtName(""); setEvtStart(""); setEvtEnd(""); setShowCalForm(false); loadCalendar(account);
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : "error"}`); }
  }

  async function completeTask(listId: string, taskId: string) {
    if (!account) return;
    try {
      await graphFetch(account, `/me/todo/lists/${listId}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : "error"}`); }
  }

  async function addTask() {
    if (!account || !newTitle.trim() || !newListId) return;
    const b: Record<string, unknown> = { title: newTitle.trim() };
    if (newDue) b.dueDateTime = { dateTime: newDue + "T00:00:00", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    try {
      await graphFetch(account, `/me/todo/lists/${newListId}/tasks`, { method: "POST", body: JSON.stringify(b) });
      setNewTitle(""); setNewDue(""); loadTasks(account);
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : "error"}`); }
  }

  /* ── AI insights ── */
  async function runAiInsights() {
    if (!account || aiLoading) return;
    setAiLoading(true); setAiError(""); setAiDismissed(new Set());
    try {
      const payload = {
        userName: profile?.displayName || account.name || "",
        userEmail: profile?.mail || profile?.userPrincipalName || account.username || "",
        emails: emails.slice(0, 15).map(m => ({
          subject: m.subject, preview: m.bodyPreview,
          sender: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "Unknown",
          receivedAt: m.receivedDateTime, isRead: m.isRead,
        })),
        chats: chats.slice(0, 20).map(c => ({
          sender: c.lastMessagePreview?.from?.user?.displayName || c.topic || "Chat",
          body: (c.lastMessagePreview?.body?.content || "").replace(/<[^>]+>/g, "").slice(0, 400),
          createdAt: c.lastMessagePreview?.createdDateTime || "",
        })),
        events: events.slice(0, 20).map(e => ({
          subject: e.subject, start: e.start.dateTime, end: e.end.dateTime,
        })),
        tasks: tasks.slice(0, 30).map(t => ({
          title: t.title, due: t.dueDateTime?.dateTime,
        })),
      };
      const r = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setAiSummary(data.summary || "");
      setAiActions(Array.isArray(data.actions) ? data.actions : []);
    } catch (e) { setAiError(e instanceof Error ? e.message : "Failed"); }
    finally { setAiLoading(false); }
  }

  async function acceptAiAction(idx: number) {
    if (!account) return;
    const action = aiActions[idx];
    if (!action) return;
    setAiAccepting(idx);
    try {
      if (action.type === "task") {
        const listId = newListId || lists[0]?.id;
        if (!listId) throw new Error("No task list available");
        const b: Record<string, unknown> = { title: action.title };
        if (action.due) b.dueDateTime = { dateTime: action.due + "T00:00:00", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        await graphFetch(account, `/me/todo/lists/${listId}/tasks`, { method: "POST", body: JSON.stringify(b) });
        loadTasks(account);
      } else {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await graphFetch(account, "/me/events", {
          method: "POST",
          body: JSON.stringify({ subject: action.title, start: { dateTime: action.start, timeZone: tz }, end: { dateTime: action.end, timeZone: tz } }),
        });
        loadCalendar(account);
      }
      setAiDismissed(prev => new Set(prev).add(idx));
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : "error"}`); }
    finally { setAiAccepting(null); }
  }

  function dismissAiAction(idx: number) {
    setAiDismissed(prev => new Set(prev).add(idx));
  }

  async function sendReply(chatId: string) {
    if (!account || !replyText.trim()) return;
    setReplying(true);
    try {
      await graphFetch(account, `/me/chats/${chatId}/messages`, { method: "POST", body: JSON.stringify({ body: { contentType: "text", content: replyText.trim() } }) });
      setReplyText(""); setReplyChat(null); loadChats(account);
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : "error"}`); }
    finally { setReplying(false); }
  }

  /* ── DM search (debounced) ── */
  useEffect(() => {
    if (!dmOpen || !account) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = dmQuery.trim();
    if (q.length < 2) { setDmResults([]); return; }
    setDmSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      try {
        const esc = q.replace(/"/g, "");
        const d = await graphFetch<{ value: GraphUser[] }>(account,
          `/users?$top=8&$select=id,displayName,mail,userPrincipalName,jobTitle&$search="displayName:${esc}" OR "mail:${esc}"`,
          { headers: { ConsistencyLevel: "eventual" } as any });
        setDmResults(d?.value ?? []);
      } catch { setDmResults([]); }
      finally { setDmSearching(false); }
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [dmQuery, dmOpen, account]);

  async function sendDm() {
    if (!account || !dmTarget || !dmMsg.trim()) return;
    setDmSending(true);
    try {
      const myId = account.localAccountId;
      const chat = await graphFetch<{ id: string }>(account, "/chats", {
        method: "POST",
        body: JSON.stringify({
          chatType: "oneOnOne",
          members: [
            { "@odata.type": "#microsoft.graph.aadUserConversationMember", roles: ["owner"], "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${myId}')` },
            { "@odata.type": "#microsoft.graph.aadUserConversationMember", roles: ["owner"], "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${dmTarget.id}')` },
          ],
        }),
      });
      if (!chat?.id) throw new Error("No chat id returned");
      await graphFetch(account, `/chats/${chat.id}/messages`, { method: "POST", body: JSON.stringify({ body: { contentType: "text", content: dmMsg.trim() } }) });
      setDmOpen(false); setDmQuery(""); setDmResults([]); setDmTarget(null); setDmMsg("");
      loadChats(account);
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : "error"}`); }
    finally { setDmSending(false); }
  }

  /* ── early states ── */
  if (initError) return (
    <div>
      <div className="page-header"><h1 className="page-title">Dashboard</h1></div>
      <div className="card" style={{ color: "var(--danger)" }}>{initError}</div>
    </div>
  );

  if (!account) return (
    <div className="ms-login">
      <div className="ms-login-logo">M</div>
      <h1 className="ms-login-title">Microsoft 365</h1>
      <p className="ms-login-sub">Sign in to see your emails, calendar, tasks and Teams chats.</p>
      <button className="btn" onClick={signIn}>Sign in with Microsoft</button>
    </div>
  );

  /* ── derived ── */
  void tick;
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const unread = emails.filter(m => !m.isRead).length;
  const todayEvts = events.filter(e => new Date(e.start.dateTime + "Z") < todayEnd);
  const nextEvt = events.find(e => new Date(e.start.dateTime + "Z") > now);
  const dueToday = tasks.filter(t => t.dueDateTime?.dateTime && new Date(t.dueDateTime.dateTime).toISOString().split("T")[0] === todayStr).length;
  const overdue = tasks.filter(t => { if (!t.dueDateTime?.dateTime) return false; const d = new Date(t.dueDateTime.dateTime); return d < now && d.toISOString().split("T")[0] !== todayStr; }).length;
  const pri = (t: TodoTask) => { if (!t.dueDateTime?.dateTime) return 3; const d = new Date(t.dueDateTime.dateTime); const s = d.toISOString().split("T")[0]; return d < now && s !== todayStr ? 0 : s === todayStr ? 1 : 2; };
  const allTasksSorted = [...tasks].sort((a, b) => { const pa = pri(a), pb = pri(b); if (pa !== pb) return pa - pb; const da = a.dueDateTime?.dateTime, db = b.dueDateTime?.dateTime; if (da && db) return new Date(da).getTime() - new Date(db).getTime(); return 0; });
  const firstName = profile?.givenName || profile?.displayName?.split(" ")[0] || "";

  // Week grid: Mon–Sun of the week containing today
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
  weekStart.setHours(0, 0, 0, 0);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
  const eventsOnDay = (ds: string) => events.filter(e => new Date(e.start.dateTime + "Z").toISOString().split("T")[0] === ds);
  const selectedDayEvts = eventsOnDay(selectedDay);

  return (
    <div className="ms-dashboard">

      {/* ── HERO ── */}
      <header className="ms-hero">
        <div className="ms-hero-left">
          <div className="ms-avatar">{avatar ? <img src={avatar} alt="" /> : ini(profile?.displayName)}</div>
          <div>
            <div className="ms-hero-greet">{greet()}{firstName ? `, ${firstName}` : ""}</div>
            <div className="ms-hero-sub">
              {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
              {profile?.mail && <> &middot; {profile.mail}</>}
            </div>
          </div>
        </div>
        <div className="ms-hero-right">
          <span className={`ms-dot${connected ? "" : " err"}`} title={connected ? "Connected" : "Disconnected"} />
          <button className="btn-ghost" onClick={() => refreshAll(account)}>Refresh</button>
          <button className="btn-ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {/* ── STATS ── */}
      <div className="ms-stats">
        <div className="ms-stat"><span className="ms-stat-val">{unread}</span><span className="ms-stat-lbl">unread</span></div>
        <div className="ms-stat"><span className="ms-stat-val">{todayEvts.length}</span><span className="ms-stat-lbl">events today</span></div>
        <div className="ms-stat"><span className="ms-stat-val">{dueToday}</span><span className="ms-stat-lbl">due today</span></div>
        <div className={`ms-stat${overdue > 0 ? " ms-stat-warn" : ""}`}><span className="ms-stat-val">{overdue}</span><span className="ms-stat-lbl">overdue</span></div>
      </div>

      {/* ── AI INSIGHTS ── */}
      <section className={`ms-ai${aiLoading ? " loading" : ""}`}>
        <div className="ms-ai-glow" aria-hidden />
        <div className="ms-ai-head">
          <div className="ms-ai-title">
            <span className="ms-ai-badge"><SparklesIcon size={14} /></span>
            <span className="ms-ai-title-text">AI Insights</span>
            {aiActions.filter((_, i) => !aiDismissed.has(i)).length > 0 && (
              <span className="ms-ai-count">{aiActions.filter((_, i) => !aiDismissed.has(i)).length}</span>
            )}
          </div>
          <button className="ms-ai-cta" onClick={runAiInsights} disabled={aiLoading}>
            {aiLoading ? (
              <><span className="ms-ai-spinner" /> <span>Analyzing…</span></>
            ) : aiSummary || aiActions.length ? (
              <><RefreshIcon size={13} /> <span>Re-analyze</span></>
            ) : (
              <><WandIcon size={13} /> <span>Analyze activity</span></>
            )}
          </button>
        </div>

        {aiError && <div className="ms-ai-err">{aiError}</div>}
        {aiSummary && (
          <div className="ms-ai-summary">
            <div className="ms-ai-summary-bar" />
            <p>{aiSummary}</p>
          </div>
        )}

        {aiActions.length > 0 && (
          <div className="ms-ai-actions">
            {aiActions.map((a, i) => {
              if (aiDismissed.has(i)) return null;
              const isTask = a.type === "task";
              return (
                <div key={i} className={`ms-ai-action ms-ai-action-${a.type}`}>
                  <div className="ms-ai-action-icon">
                    {isTask ? <CheckCircleIcon size={18} /> : <CalendarIcon size={18} />}
                  </div>
                  <div className="ms-ai-action-main">
                    <div className="ms-ai-action-head">
                      <span className={`ms-ai-tag ms-ai-tag-${a.type}`}>{isTask ? "Task" : "Event"}</span>
                      <span className="ms-ai-action-title">{a.title}</span>
                    </div>
                    <div className="ms-ai-action-meta">
                      {isTask && a.due && <span className="ms-ai-action-when">due {a.due}</span>}
                      {!isTask && <span className="ms-ai-action-when">{new Date(a.start).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                      <span className="ms-ai-action-src">{a.source}</span>
                    </div>
                    <div className="ms-ai-action-reason">{a.reason}</div>
                  </div>
                  <div className="ms-ai-action-btns">
                    <button className="ms-ai-accept" disabled={aiAccepting === i} onClick={() => acceptAiAction(i)} title="Add">
                      {aiAccepting === i ? <span className="ms-ai-spinner-sm" /> : <CheckIcon size={16} />}
                    </button>
                    <button className="ms-ai-dismiss" onClick={() => dismissAiAction(i)} title="Dismiss">
                      <XIcon size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!aiLoading && !aiError && !aiSummary && aiActions.length === 0 && (
          <div className="ms-ai-empty">
            <SparklesIcon size={18} />
            <span>Let AI scan your emails, chats, and events for tasks and meetings you might miss.</span>
          </div>
        )}
      </section>

      {/* ── MAIN LAYOUT ── */}
      <div className="ms-content">

        {/* LEFT: Tabbed Teams / Inbox */}
        <div className="ms-left-col">
          <section className="ms-panel ms-left-panel">

            {/* Tab bar */}
            <div className="ms-tab-bar">
              <button
                className={`ms-tab${leftTab === "teams" ? " active" : ""}`}
                onClick={() => setLeftTab("teams")}>
                Teams{errs.chat ? " !" : ""}
              </button>
              <button
                className={`ms-tab${leftTab === "inbox" ? " active" : ""}`}
                onClick={() => setLeftTab("inbox")}>
                Inbox{unread > 0 ? ` (${unread})` : ""}
              </button>
              {leftTab === "teams" && (
                <button className="btn-ghost ms-tab-action" onClick={() => { setDmOpen(v => !v); setDmTarget(null); setDmQuery(""); setDmResults([]); setDmMsg(""); }}>
                  {dmOpen ? "Cancel" : "New message"}
                </button>
              )}
            </div>

            {/* TEAMS tab */}
            {leftTab === "teams" && (
              <>
                {dmOpen && (
                  <div className="ms-compose">
                    {!dmTarget ? (
                      <>
                        <input autoFocus placeholder="Name or email..." value={dmQuery} onChange={e => setDmQuery(e.target.value)} />
                        <div className="ms-compose-results">
                          {dmSearching && <div className="ms-muted-small">Searching...</div>}
                          {!dmSearching && dmQuery.trim().length >= 2 && dmResults.length === 0 && <div className="ms-muted-small">No results</div>}
                          {dmResults.map(u => (
                            <button key={u.id} className="ms-compose-user" onClick={() => setDmTarget(u)}>
                              <div className="ms-avatar ms-avatar-sm">{ini(u.displayName)}</div>
                              <div>
                                <div className="ms-compose-name">{u.displayName}</div>
                                <div className="ms-muted-small">{u.mail || u.userPrincipalName}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="ms-compose-to">
                          <span className="ms-muted-small">To</span>
                          <div className="ms-avatar ms-avatar-sm">{ini(dmTarget.displayName)}</div>
                          <span className="ms-compose-name">{dmTarget.displayName}</span>
                          <button className="btn-ghost" onClick={() => setDmTarget(null)}>Change</button>
                        </div>
                        <textarea autoFocus rows={3} placeholder="Write a message... (Ctrl+Enter to send)"
                          value={dmMsg} onChange={e => setDmMsg(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendDm(); }}
                          disabled={dmSending} />
                        <div className="ms-compose-footer">
                          <button className="btn" onClick={sendDm} disabled={dmSending || !dmMsg.trim()}>
                            {dmSending ? "Sending..." : "Send"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="ms-panel-body ms-scroll-body">
                  {errs.chat ? <div className="ms-err">{errs.chat}</div>
                  : chats.length === 0 ? <Empty text="No recent chats" />
                  : chats.map(c => {
                    const p = c.lastMessagePreview!;
                    const sender = p.from?.user?.displayName || c.topic || "Chat";
                    const body = (p.body?.content || "").replace(/<[^>]+>/g, "");
                    // Highlight only if someone else mentions the user — not the user's own messages
                    const hi = isHL(body, sender) || isHL(c.topic, sender);
                    const open = replyChat === c.id;
                    return (
                      <div key={c.id} className={`ms-chat${hi ? " mention" : ""}`}
                        onClick={() => { if (!open) { setReplyChat(c.id); setReplyText(""); } }}>
                        <div className="ms-chat-row">
                          <div className="ms-avatar ms-avatar-sm">{ini(sender)}</div>
                          <div className="ms-chat-body">
                            <div className="ms-chat-meta">
                              <span className="ms-chat-name">{sender}</span>
                              <span className="ms-chat-time">{fmtTime(p.createdDateTime)}</span>
                            </div>
                            <div className="ms-chat-preview">{body}</div>
                          </div>
                        </div>
                        {open && (
                          <div className="ms-chat-reply" onClick={e => e.stopPropagation()}>
                            <input autoFocus placeholder="Reply..." value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") sendReply(c.id); if (e.key === "Escape") setReplyChat(null); }}
                              disabled={replying} />
                            <button className="btn" onClick={() => sendReply(c.id)} disabled={replying || !replyText.trim()}>{replying ? "..." : "Send"}</button>
                            <button className="btn-ghost" onClick={() => setReplyChat(null)}>Cancel</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* INBOX tab */}
            {leftTab === "inbox" && (
              <div className="ms-panel-body ms-scroll-body">
                {errs.email ? <div className="ms-err">{errs.email} <button className="btn-ghost" onClick={() => loadEmails(account)}>Retry</button></div>
                : emails.length === 0 ? <Empty text="Inbox zero" />
                : emails.map(m => {
                  // Highlight emails where subject/preview mentions the user but sender is not the user
                  const senderName = m.from?.emailAddress?.name || m.from?.emailAddress?.address || "";
                  const hi = isHL(m.subject, senderName) || isHL(m.bodyPreview, senderName);
                  return (
                    <div key={m.id} className={`ms-email${!m.isRead ? " unread" : ""}${hi ? " mention" : ""}`}
                      onClick={() => openEmail(m.id, !m.isRead)}>
                      <div className="ms-email-row">
                        <div className="ms-email-from">{senderName || "?"}</div>
                        <div className="ms-email-time">{fmtTime(m.receivedDateTime)}</div>
                      </div>
                      <div className="ms-email-subject">{m.subject}</div>
                      <div className="ms-email-preview">{m.bodyPreview}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: Calendar → Todo */}
        <div className="ms-right-col">

          {/* CALENDAR WIDGET */}
          <section className="ms-panel ms-cal-panel">

            {/* Next event card */}
            {nextEvt ? (
              <div className="ms-next-evt ms-next-evt-highlight">
                <div className="ms-next-evt-pill">up next · in {relTime(nextEvt.start.dateTime + "Z")}</div>
                <div className="ms-next-evt-name">{nextEvt.subject}</div>
                <div className="ms-next-evt-time">{fmtTime(nextEvt.start.dateTime + "Z")} – {fmtTime(nextEvt.end.dateTime + "Z")}</div>
              </div>
            ) : (
              <div className="ms-next-evt ms-next-evt-empty">No upcoming events</div>
            )}

            {/* Week grid */}
            <div className="ms-week">
              {weekDays.map(d => {
                const ds = d.toISOString().split("T")[0];
                const isToday = ds === todayStr;
                const isSel = ds === selectedDay;
                const count = eventsOnDay(ds).length;
                return (
                  <button key={ds}
                    className={`ms-week-day${isToday ? " today" : ""}${isSel ? " sel" : ""}`}
                    onClick={() => setSelectedDay(ds)}>
                    <span className="ms-week-wd">{d.toLocaleDateString([], { weekday: "short" }).slice(0, 1)}</span>
                    <span className="ms-week-num">{d.getDate()}</span>
                    <span className="ms-week-dot-row">
                      {count > 0 && <span className="ms-week-dot" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected day events */}
            <div className="ms-day-evts">
              {selectedDayEvts.length === 0
                ? <div className="ms-muted-small">{selectedDay === todayStr ? "Nothing today" : "No events"}</div>
                : selectedDayEvts.map(e => (
                  <div key={e.id} className="ms-day-evt">
                    <span className="ms-day-evt-time">{fmtTime(e.start.dateTime + "Z")}</span>
                    <span className="ms-day-evt-name">{e.subject}</span>
                  </div>
                ))}
            </div>

            {/* New event form */}
            <div className="ms-cal-foot">
              <button className="btn-ghost ms-cal-add-btn" onClick={() => setShowCalForm(v => !v)}>
                {showCalForm ? "Cancel" : "+ New event"}
              </button>
              {showCalForm && (
                <div className="ms-evt-form">
                  <input placeholder="Event name" value={evtName} onChange={e => setEvtName(e.target.value)} />
                  <input type="datetime-local" value={evtStart} onChange={e => setEvtStart(e.target.value)} />
                  <input type="datetime-local" value={evtEnd} onChange={e => setEvtEnd(e.target.value)} />
                  <button className="btn" onClick={addEvent}>Create</button>
                </div>
              )}
            </div>
          </section>

          {/* TODO STRIP */}
          <section className="ms-panel ms-todo-panel">
            <div className="ms-panel-head">
              <span className="ms-panel-title">To Do</span>
              {(dueToday > 0 || overdue > 0) && (
                <span className="ms-count">{dueToday > 0 ? `${dueToday} today` : `${overdue} overdue`}</span>
              )}
            </div>
            <div className="ms-todo-list">
              {errs.tasks ? <div className="ms-err">{errs.tasks}</div>
              : allTasksSorted.length === 0 ? <Empty text="All caught up" />
              : allTasksSorted.map(t => {
                const due = t.dueDateTime?.dateTime ? new Date(t.dueDateTime.dateTime) : null;
                const ds = due?.toISOString().split("T")[0];
                const od = due && due < now && ds !== todayStr;
                const td = ds === todayStr;
                return (
                  <div key={t.id} className={`ms-todo-row${od ? " overdue" : td ? " today" : ""}`}>
                    <button className="ms-check" onClick={() => completeTask(t.listId, t.id)} aria-label="Complete" />
                    <span className="ms-todo-title">{t.title}</span>
                    {due && <span className={`ms-todo-due${od ? " overdue" : ""}`}>{td ? "Today" : fmtDate(t.dueDateTime?.dateTime)}</span>}
                  </div>
                );
              })}
            </div>
            <div className="ms-todo-add">
              <input placeholder="Add a task..." value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTask()} />
              <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)} />
              <select value={newListId} onChange={e => setNewListId(e.target.value)}>
                {lists.map(l => <option key={l.id} value={l.id}>{l.displayName}</option>)}
              </select>
              <button className="btn" onClick={addTask}>Add</button>
            </div>
          </section>
        </div>
      </div>

      {/* ── EMAIL MODAL ── */}
      {expandedEmail && (() => {
        const m = emails.find(e => e.id === expandedEmail);
        if (!m) return null;
        const htmlBody = emailBodies[expandedEmail];
        return (
          <div className="ms-mail-backdrop" onClick={() => setExpandedEmail(null)}>
            <div className="ms-mail-modal" onClick={e => e.stopPropagation()}>
              <div className="ms-mail-modal-head">
                <div className="ms-mail-modal-meta">
                  <div className="ms-mail-modal-subject">{m.subject}</div>
                  <div className="ms-mail-modal-info">
                    <span className="ms-mail-modal-from">{m.from?.emailAddress?.name || m.from?.emailAddress?.address}</span>
                    <span className="ms-mail-modal-date">{fmtDate(m.receivedDateTime)} · {fmtTime(m.receivedDateTime)}</span>
                  </div>
                </div>
                <button className="btn-ghost" onClick={() => setExpandedEmail(null)}>Close</button>
              </div>
              <div className="ms-mail-modal-body">
                {!htmlBody ? <div className="ms-muted-small" style={{ padding: 20 }}>Loading...</div>
                : <iframe title="Email" sandbox="allow-same-origin"
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
                      *,*::before,*::after{box-sizing:border-box}
                      /* Force dark theme — override any inline bgcolor/color from email HTML */
                      html,body,table,tbody,tr,td,th,div,span,p,section,article,header,footer,main{
                        background-color:#18181b!important;color:#e4e4e7!important;
                        border-color:#3f3f46!important;
                      }
                      body{margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.6;word-wrap:break-word}
                      a{color:#38bdf8!important}
                      /* Keep images natural but slightly dim them */
                      img{max-width:100%!important;height:auto;filter:brightness(0.92)}
                      table{max-width:100%;border-collapse:collapse}td,th{padding:4px 8px}
                      blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #52525b!important;color:#a1a1aa!important}
                      pre,code{font-family:ui-monospace,monospace;font-size:13px;background:#09090b!important;border-radius:4px}
                      pre{padding:12px;overflow-x:auto}code{padding:2px 5px}
                      h1,h2,h3,h4,h5,h6{margin:16px 0 8px;line-height:1.3;color:#f4f4f5!important}
                      p{margin:0 0 8px}ul,ol{padding-left:20px;margin:0 0 8px}
                      hr{border:none;border-top:1px solid #3f3f46!important;margin:12px 0}
                      /* Muted text that was near-white on light bg — bring it up */
                      [style*="color:#fff"],[style*="color: #fff"],[style*="color:white"],[style*="color: white"]{color:#e4e4e7!important}
                    </style></head><body>${htmlBody}</body></html>`}
                    className="ms-mail-iframe" />}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="ms-empty">{text}</div>;
}
