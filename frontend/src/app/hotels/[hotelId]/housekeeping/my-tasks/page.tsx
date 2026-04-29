"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";
import { loadAuthUser } from "@/lib/auth";
import { staffAppPath } from "@/lib/staffAppRoutes";

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

function roleCanSupervise(role: string | undefined) {
  return (
    role === "SUPER_ADMIN" ||
    role === "HOTEL_ADMIN" ||
    role === "MANAGER" ||
    role === "HOUSEKEEPING_SUPERVISOR"
  );
}

export default function HousekeepingMyTasksPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const qc = useQueryClient();
  const user = useMemo(() => (typeof window !== "undefined" ? loadAuthUser() : null), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["hk-my", hotelId],
    enabled: !!getToken(),
    refetchInterval: 60_000,
    queryFn: () => apiFetch<BoardTask[]>(`/api/v1/hotels/${hotelId}/housekeeping/tasks/my`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hk-my", hotelId] });

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
    return <p className="text-muted-foreground p-4">Sign in.</p>;
  }

  const supervisor = roleCanSupervise(user?.role);
  const tasks = q.data ?? [];

  return (
    <div className="max-w-lg mx-auto space-y-4 px-2 pb-8">
      <div className="flex items-center justify-between gap-2 pt-2">
        <h1 className="text-xl font-bold">My housekeeping</h1>
        <Link href={staffAppPath("housekeeping")} className="text-sm text-primary">
          Board
        </Link>
      </div>
      {q.isError && <div className="error text-sm">{(q.error as Error).message}</div>}
      {msg && <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{msg}</div>}

      <ul className="space-y-4">
        {tasks.map((t) => {
          const mine = t.assignedTo != null && t.assignedTo === user?.id;
          const canAct = supervisor || mine;
          const busy = busyId !== null;
          return (
            <li
              key={t.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3 min-h-[120px]"
            >
              <div className="flex justify-between items-start">
                <span className="text-2xl font-bold">{t.roomNumber}</span>
                <span className="text-xs font-semibold uppercase text-muted-foreground">{t.priority}</span>
              </div>
              <p className="text-sm font-medium">{t.taskType.replace(/_/g, " ")}</p>
              <p className="text-xs text-muted-foreground">{t.status}</p>
              {t.notes && <p className="text-sm text-muted-foreground">{t.notes}</p>}
              <div className="flex flex-col gap-2">
                {canAct && (t.status === "PENDING" || t.status === "SKIPPED_DND") && (
                  <button
                    type="button"
                    className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-base font-medium disabled:opacity-50"
                    disabled={busy}
                    onClick={() =>
                      exec(t.id, "Started", () =>
                        apiFetch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${t.id}/start`, {
                          method: "PATCH",
                          body: JSON.stringify({}),
                        }),
                      )
                    }
                  >
                    Start
                  </button>
                )}
                {canAct && t.status === "IN_PROGRESS" && (
                  <button
                    type="button"
                    className="w-full py-3 rounded-lg bg-emerald-600 text-white text-base font-medium disabled:opacity-50"
                    disabled={busy}
                    onClick={() =>
                      exec(t.id, "Completed", () =>
                        apiFetch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${t.id}/complete`, {
                          method: "PATCH",
                          body: JSON.stringify({
                            notes: "",
                            photo_url: null,
                            checklist_completed: true,
                          }),
                        }),
                      )
                    }
                  >
                    Complete
                  </button>
                )}
                {canAct && (
                  <button
                    type="button"
                    className="w-full py-3 rounded-lg border border-border text-base font-medium disabled:opacity-50"
                    disabled={busy}
                    onClick={() =>
                      exec(t.id, "Skipped DND", () =>
                        apiFetch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${t.id}/skip-dnd`, {
                          method: "PATCH",
                          body: JSON.stringify({}),
                        }),
                      )
                    }
                  >
                    Skip DND
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {tasks.length === 0 && !q.isLoading && (
        <p className="text-center text-muted-foreground py-8">No tasks assigned to you.</p>
      )}
    </div>
  );
}
