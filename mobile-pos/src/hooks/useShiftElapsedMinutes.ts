import { useEffect, useState } from "react";
import { elapsedMinutesSince } from "../lib/shiftDuration";

/** Live shift duration from openedAt; ticks every 10s so minutes update promptly. */
export function useShiftElapsedMinutes(openedAt: unknown, enabled: boolean): number {
  const [elapsed, setElapsed] = useState(() => (enabled ? elapsedMinutesSince(openedAt) : 0));

  useEffect(() => {
    if (!enabled) {
      setElapsed(0);
      return;
    }

    const tick = () => setElapsed(elapsedMinutesSince(openedAt));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [openedAt, enabled]);

  return elapsed;
}
