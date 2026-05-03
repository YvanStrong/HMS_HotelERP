"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";
import { loadAuthUser } from "@/lib/auth";
type BoardTask = {
  id: string;
  roomNumber: string;
  taskType: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  assignedToName: string | null;
  createdAt: string;
  notes: string | null;
  room_dnd?: boolean | null;
  room_dnd_until?: string | null;
};

type Board = {
  pending: BoardTask[];
  inProgress: BoardTask[];
  completed: BoardTask[];
  inspected: BoardTask[];
};

type StaffOption = { id: string; username: string; role: string };
type RoomOption = { id: string; roomNumber: string; status: string };

function roleCanSupervise(role: string | undefined) {
  return (
    role === "SUPER_ADMIN" ||
    role === "HOTEL_ADMIN" ||
    role === "MANAGER" ||
    role === "HOUSEKEEPING_SUPERVISOR"
  );
}

function taskTypePillClass(t: string) {
  switch (t) {
    case "DEPARTURE_CLEAN":
      return "bg-red-100 text-red-800 border-red-200";
    case "STAYOVER_CLEAN":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "INSPECTION":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "DEEP_CLEAN":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "MINIBAR_RESTOCK":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "TURNDOWN":
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function priorityBadgeClass(p: string) {
  switch (p) {
    case "URGENT":
      return "bg-red-600 text-white";
    case "HIGH":
      return "bg-orange-500 text-white";
    case "NORMAL":
      return "bg-blue-600 text-white";
    case "LOW":
      return "bg-gray-400 text-white";
    default:
      return "bg-muted text-foreground";
  }
}

function formatSince(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TaskCard({
  task,
  userId,
  userRole,
  staff,
  onAssign,
  onStart,
  onComplete,
  onInspect,
  onSkipDnd,
  busyId,
}: {
  task: BoardTask;
  userId: string | undefined;
  userRole: string | undefined;
  staff: StaffOption[];
  onAssign: (taskId: string, staffId: string) => void;
  onStart: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onInspect: (taskId: string) => void;
  onSkipDnd: (taskId: string) => void;
  busyId: string | null;
}) {
  const supervisor = roleCanSupervise(userRole);
  const mine = task.assignedTo != null && task.assignedTo === userId;
  const canAct = supervisor || mine;
  const disabled = busyId !== null;

  return (
    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xl font-bold tracking-tight">{task.roomNumber}</span>
        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${priorityBadgeClass(task.priority)}`}>
          {task.priority}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${taskTypePillClass(task.taskType)}`}>
          {task.taskType.replace(/_/g, " ")}
        </span>
        {task.room_dnd && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-red-200 bg-red-100 text-red-800">
            DND ACTIVE
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {task.assignedToName ? (
          <span>{task.assignedToName}</span>
        ) : (
          <span className="italic text-gray-500">Unassigned</span>
        )}
      </p>
      <p className="text-[11px] text-muted-foreground">Created {formatSince(task.createdAt)}</p>
      {task.notes && <p className="text-xs text-muted-foreground line-clamp-2">{task.notes}</p>}

      {supervisor && (
        <div className="pt-1">
          <label className="text-[10px] uppercase text-muted-foreground block mb-0.5">Assign</label>
          <select
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-background"
            value=""
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value;
              if (v) onAssign(task.id, v);
              e.target.value = "";
            }}
          >
            <option value="">Choose staff…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.username} ({s.role})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {canAct && (task.status === "PENDING" || task.status === "SKIPPED_DND") && (
          <button
            type="button"
            className="text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
            disabled={disabled}
            onClick={() => onStart(task.id)}
          >
            Start
          </button>
        )}
        {canAct && task.status === "IN_PROGRESS" && (
          <button
            type="button"
            className="text-xs px-2 py-1 rounded-md bg-emerald-600 text-white disabled:opacity-50"
            disabled={disabled}
            onClick={() => onComplete(task.id)}
          >
            Complete
          </button>
        )}
        {supervisor && task.status === "COMPLETED" && (
          <button
            type="button"
            className="text-xs px-2 py-1 rounded-md bg-violet-600 text-white disabled:opacity-50"
            disabled={disabled}
            onClick={() => onInspect(task.id)}
          >
            Inspect
          </button>
        )}
        {canAct && (
          <button
            type="button"
            className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground disabled:opacity-50"
            disabled={disabled}
            onClick={() => onSkipDnd(task.id)}
          >
            Skip DND
          </button>
        )}
      </div>
    </div>
  );
}

export default function HousekeepingKanbanPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const qc = useQueryClient();
  const user = useMemo(() => (typeof window !== "undefined" ? loadAuthUser() : null), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(true);
  const [completeTaskId, setCompleteTaskId] = useState<string | null>(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [inspectTaskId, setInspectTaskId] = useState<string | null>(null);
  const [inspectScore, setInspectScore] = useState("8");
  const [createOpen, setCreateOpen] = useState(false);
  const [createRoomId, setCreateRoomId] = useState("");
  const [createTaskType, setCreateTaskType] = useState("DEPARTURE_CLEAN");
  const [createPriority, setCreatePriority] = useState("NORMAL");
  const [createNotes, setCreateNotes] = useState("");
  const [createAssignTo, setCreateAssignTo] = useState("");
  const [createBookingId, setCreateBookingId] = useState("");

  const boardQ = useQuery({
    queryKey: ["hk-board", hotelId],
    enabled: !!getToken(),
    refetchInterval: 60_000,
    queryFn: () => apiFetch<Board>(`/api/v1/hotels/${hotelId}/housekeeping/tasks`),
  });

  const staffQ = useQuery({
    queryKey: ["hk-staff", hotelId],
    enabled: !!getToken() && roleCanSupervise(user?.role),
    queryFn: () => apiFetch<StaffOption[]>(`/api/v1/hotels/${hotelId}/housekeeping/assignable-staff`),
  });

  const roomsQ = useQuery({
    queryKey: ["hk-room-options", hotelId],
    enabled: !!getToken() && roleCanSupervise(user?.role),
    queryFn: () => apiFetch<{ data: RoomOption[] }>(`/api/v1/hotels/${hotelId}/rooms?page=1&size=500`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hk-board", hotelId] });

  const exec = async (taskId: string, okMsg: string, fn: () => Promise<void>) => {
    setMsg(null);
    setBusyId(taskId);
    try {
      await fn();
      await invalidate();
      setMsg(okMsg);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusyId(null);
    }
  };

  if (!getToken()) {
    return <p className="text-muted-foreground">Sign in to view housekeeping.</p>;
  }

  const columns: { key: keyof Board; title: string }[] = [
    { key: "pending", title: "PENDING" },
    { key: "inProgress", title: "IN PROGRESS" },
    { key: "completed", title: "COMPLETED" },
    { key: "inspected", title: "INSPECTED" },
  ];

  const filteredBoard: Board = {
    pending: (boardQ.data?.pending ?? []).filter((t) => !mineOnly || t.assignedTo === user?.id),
    inProgress: (boardQ.data?.inProgress ?? []).filter((t) => !mineOnly || t.assignedTo === user?.id),
    completed: (boardQ.data?.completed ?? []).filter((t) => !mineOnly || t.assignedTo === user?.id),
    inspected: (boardQ.data?.inspected ?? []).filter((t) => !mineOnly || t.assignedTo === user?.id),
  };

  const totals = useMemo(() => {
    const pending = filteredBoard.pending.length;
    const inProgress = filteredBoard.inProgress.length;
    const completed = filteredBoard.completed.length;
    const inspected = filteredBoard.inspected.length;
    const urgent = [
      ...filteredBoard.pending,
      ...filteredBoard.inProgress,
      ...filteredBoard.completed,
    ].filter((t) => t.priority === "URGENT").length;
    const dndBlocked = [
      ...filteredBoard.pending,
      ...filteredBoard.inProgress,
      ...filteredBoard.completed,
    ].filter((t) => t.room_dnd).length;
    return { pending, inProgress, completed, inspected, urgent, dndBlocked };
  }, [filteredBoard]);

  async function submitCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!createRoomId) {
      setMsg("Choose a room for the task.");
      return;
    }
    setBusyId("create-task");
    setMsg(null);
    try {
      const created = await apiFetch<BoardTask>(`/api/v1/hotels/${hotelId}/housekeeping/tasks`, {
        method: "POST",
        body: JSON.stringify({
          room_id: createRoomId,
          booking_id: createBookingId.trim() ? createBookingId.trim() : null,
          task_type: createTaskType,
          priority: createPriority,
          notes: createNotes.trim() || null,
        }),
      });
      if (createAssignTo) {
        await apiFetch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${created.id}/assign`, {
          method: "PATCH",
          body: JSON.stringify({ assigned_to: createAssignTo }),
        });
      }
      await invalidate();
      setCreateOpen(false);
      setCreateRoomId("");
      setCreateNotes("");
      setCreateBookingId("");
      setCreateAssignTo("");
      setMsg("Task created.");
    } catch (e2) {
      setMsg(e2 instanceof Error ? e2.message : "Could not create task");
    } finally {
      setBusyId(null);
    }
  }

  async function submitCompleteTask(e: React.FormEvent) {
    e.preventDefault();
    if (!completeTaskId) return;
    await exec(completeTaskId, "Completed", () =>
      apiFetch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${completeTaskId}/complete`, {
        method: "PATCH",
        body: JSON.stringify({
          notes: completeNotes.trim() || "",
          photo_url: null,
          checklist_completed: true,
        }),
      }),
    );
    setCompleteTaskId(null);
    setCompleteNotes("");
  }

  async function submitInspectTask(e: React.FormEvent) {
    e.preventDefault();
    if (!inspectTaskId) return;
    const score = Number(inspectScore);
    if (Number.isNaN(score) || score < 1 || score > 10) {
      setMsg("Inspection score must be between 1 and 10.");
      return;
    }
    await exec(inspectTaskId, "Inspected", () =>
      apiFetch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${inspectTaskId}/inspect`, {
        method: "PATCH",
        body: JSON.stringify({ score }),
      }),
    );
    setInspectTaskId(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Housekeeping</h1>
            <p className="text-muted-foreground text-sm mt-1">Task board, assignment, completion checklist, and supervisor inspection</p>
          </div>
          {roleCanSupervise(user?.role) && (
            <button type="button" className="hms-btn-solid text-sm" onClick={() => setCreateOpen(true)}>
              Create task
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-3"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold">{totals.pending}</p></div>
        <div className="rounded-xl border border-border/60 bg-card p-3"><p className="text-xs text-muted-foreground">In progress</p><p className="text-xl font-bold">{totals.inProgress}</p></div>
        <div className="rounded-xl border border-border/60 bg-card p-3"><p className="text-xs text-muted-foreground">Completed</p><p className="text-xl font-bold">{totals.completed}</p></div>
        <div className="rounded-xl border border-border/60 bg-card p-3"><p className="text-xs text-muted-foreground">Inspected</p><p className="text-xl font-bold">{totals.inspected}</p></div>
        <div className="rounded-xl border border-border/60 bg-card p-3"><p className="text-xs text-muted-foreground">Urgent</p><p className="text-xl font-bold text-red-600">{totals.urgent}</p></div>
        <div className="rounded-xl border border-border/60 bg-card p-3"><p className="text-xs text-muted-foreground">DND blocked</p><p className="text-xl font-bold text-amber-700">{totals.dndBlocked}</p></div>
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Visibility</span>
        <label className="inline-flex items-center gap-2 font-medium">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
          Show only tasks assigned to me
        </label>
      </div>
      {boardQ.isError && <div className="error text-sm">{(boardQ.error as Error).message}</div>}
      {msg && (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" role="status">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {columns.map((col) => (
          <div key={col.key} className="rounded-xl border border-border/60 bg-muted/20 p-3 min-h-[200px]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              {col.title} <span className="text-foreground">({filteredBoard[col.key].length})</span>
            </h2>
            <div className="space-y-2">
              {filteredBoard[col.key].map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  userId={user?.id}
                  userRole={user?.role}
                  staff={staffQ.data ?? []}
                  busyId={busyId}
                  onAssign={(taskId, staffId) =>
                    exec(taskId, "Assigned", () =>
                      apiFetch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${taskId}/assign`, {
                        method: "PATCH",
                        body: JSON.stringify({ assigned_to: staffId }),
                      }),
                    )
                  }
                  onStart={(taskId) =>
                    exec(taskId, "Started", () =>
                      apiFetch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${taskId}/start`, {
                        method: "PATCH",
                        body: JSON.stringify({}),
                      }),
                    )
                  }
                  onComplete={(taskId) =>
                    setCompleteTaskId(taskId)
                  }
                  onInspect={(taskId) => setInspectTaskId(taskId)}
                  onSkipDnd={(taskId) =>
                    exec(taskId, "Skipped DND", () =>
                      apiFetch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${taskId}/skip-dnd`, {
                        method: "PATCH",
                        body: JSON.stringify({}),
                      }),
                    )
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {completeTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Complete task</h3>
            <p className="text-sm text-muted-foreground mt-1">Confirm checklist completion and add optional notes.</p>
            <form onSubmit={submitCompleteTask} className="mt-4">
              <label>Completion notes (optional)</label>
              <textarea value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value)} />
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="hms-btn-outline" onClick={() => setCompleteTaskId(null)}>Cancel</button>
                <button type="submit" className="hms-btn-solid">Confirm complete</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {inspectTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Supervisor inspection</h3>
            <p className="text-sm text-muted-foreground mt-1">Score this task from 1 (poor) to 10 (excellent).</p>
            <form onSubmit={submitInspectTask} className="mt-4">
              <label>Inspection score</label>
              <input type="number" min="1" max="10" value={inspectScore} onChange={(e) => setInspectScore(e.target.value)} />
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="hms-btn-outline" onClick={() => setInspectTaskId(null)}>Cancel</button>
                <button type="submit" className="hms-btn-solid">Submit inspection</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Create housekeeping task</h3>
            <form onSubmit={submitCreateTask} className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="md:col-span-2">
                Room
                <select value={createRoomId} onChange={(e) => setCreateRoomId(e.target.value)}>
                  <option value="">Choose room...</option>
                  {(roomsQ.data?.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber} ({r.status.replaceAll("_", " ")})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Task type
                <select value={createTaskType} onChange={(e) => setCreateTaskType(e.target.value)}>
                  {["DEPARTURE_CLEAN", "STAYOVER_CLEAN", "INSPECTION", "DEEP_CLEAN", "MINIBAR_RESTOCK", "TURNDOWN"].map((t) => (
                    <option key={t} value={t}>{t.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select value={createPriority} onChange={(e) => setCreatePriority(e.target.value)}>
                  {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                Assign to (optional)
                <select value={createAssignTo} onChange={(e) => setCreateAssignTo(e.target.value)}>
                  <option value="">Unassigned</option>
                  {(staffQ.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.username} ({s.role})</option>
                  ))}
                </select>
              </label>
              <label>
                Booking ID (optional)
                <input value={createBookingId} onChange={(e) => setCreateBookingId(e.target.value)} placeholder="Reservation UUID" />
              </label>
              <label className="md:col-span-2">
                Notes (optional)
                <textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} />
              </label>
              <div className="md:col-span-2 flex justify-end gap-2 mt-1">
                <button type="button" className="hms-btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button>
                <button type="submit" className="hms-btn-solid" disabled={busyId === "create-task"}>
                  {busyId === "create-task" ? "Creating..." : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
