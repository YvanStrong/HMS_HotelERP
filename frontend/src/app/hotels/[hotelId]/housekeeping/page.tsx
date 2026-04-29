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
};

type Board = {
  pending: BoardTask[];
  inProgress: BoardTask[];
  completed: BoardTask[];
  inspected: BoardTask[];
};

type StaffOption = { id: string; username: string; role: string };

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Housekeeping</h1>
        <p className="text-muted-foreground text-sm mt-1">Kanban board · auto-refreshes every 60s</p>
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
              {col.title}{" "}
              <span className="text-foreground">({(boardQ.data?.[col.key] ?? []).length})</span>
            </h2>
            <div className="space-y-2">
              {(boardQ.data?.[col.key] ?? []).map((t) => (
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
                    exec(taskId, "Completed", () =>
                      apiFetch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${taskId}/complete`, {
                        method: "PATCH",
                        body: JSON.stringify({
                          notes: "",
                          photo_url: null,
                          checklist_completed: true,
                        }),
                      }),
                    )
                  }
                  onInspect={(taskId) => {
                    const scoreStr = window.prompt("Inspection score (1–10)?", "8");
                    if (!scoreStr) return;
                    const score = Number(scoreStr);
                    if (Number.isNaN(score)) return;
                    void exec(taskId, "Inspected", () =>
                      apiFetch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${taskId}/inspect`, {
                        method: "PATCH",
                        body: JSON.stringify({ score }),
                      }),
                    );
                  }}
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
    </div>
  );
}
