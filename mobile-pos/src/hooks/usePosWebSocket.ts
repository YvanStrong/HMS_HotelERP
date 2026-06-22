import { useEffect } from "react";
import { Client } from "@stomp/stompjs";
import { getApiBaseUrl } from "../api/settings";
import { getStoredToken } from "../api/client";

function wsBrokerUrl(): string {
  const base = getApiBaseUrl().replace(/\/$/, "");
  return base.replace(/^http/, "ws") + "/ws";
}

/** Subscribe to hotel POS STOMP topics; calls onMessage when any event arrives. */
export function usePosWebSocket(
  hotelId: string | undefined,
  topics: string[],
  onMessage: () => void,
  enabled = true,
  onConnectedChange?: (connected: boolean) => void,
): void {
  useEffect(() => {
    if (!enabled || !hotelId || topics.length === 0) return;
    let client: Client | null = null;
    let cancelled = false;

    void (async () => {
      const token = await getStoredToken();
      if (!token || cancelled) return;

      client = new Client({
        brokerURL: wsBrokerUrl(),
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 5000,
        onConnect: () => {
          onConnectedChange?.(true);
          for (const topic of topics) {
            client?.subscribe(topic, () => onMessage());
          }
        },
        onDisconnect: () => onConnectedChange?.(false),
        onWebSocketClose: () => onConnectedChange?.(false),
      });
      client.activate();
    })();

    return () => {
      cancelled = true;
      onConnectedChange?.(false);
      void client?.deactivate();
    };
  }, [hotelId, enabled, onMessage, onConnectedChange, topics.join("|")]);
}
