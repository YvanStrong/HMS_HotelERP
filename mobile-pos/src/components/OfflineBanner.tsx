import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { syncOfflineQueue } from "../hooks/offlineSync";
import { useOfflineQueueStore } from "../store/offlineQueueStore";

export function OfflineBanner() {
  const isOnline = useOfflineQueueStore((s) => s.isOnline);
  const isSyncing = useOfflineQueueStore((s) => s.isSyncing);
  const syncFlash = useOfflineQueueStore((s) => s.syncCompleteFlash);
  const queue = useOfflineQueueStore((s) => s.queue);
  const retryFailed = useOfflineQueueStore((s) => s.retryFailed);
  const pending = queue.length;
  const failed = useMemo(() => queue.filter((a) => a.retryCount >= 3), [queue]);
  const [showFailed, setShowFailed] = useState(false);

  if (failed.length > 0) {
    return (
      <>
        <View className="bg-red-700 px-4 py-3">
          <Text className="text-center text-sm font-semibold text-white">
            ⚠️ {failed.length} order{failed.length === 1 ? "" : "s"} failed to sync. Please inform your manager.
          </Text>
          <View className="mt-2 flex-row justify-center gap-3">
            <Pressable onPress={() => setShowFailed(true)} className="rounded-lg bg-white/20 px-3 py-1.5">
              <Text className="text-xs font-bold text-white">View failed orders</Text>
            </Pressable>
            {isOnline ? (
              <Pressable onPress={() => retryFailed()} className="rounded-lg bg-white/20 px-3 py-1.5">
                <Text className="text-xs font-bold text-white">Retry all</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <Modal visible={showFailed} transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/40">
            <View className="max-h-[70%] rounded-t-2xl bg-white p-4">
              <Text className="mb-3 text-lg font-bold text-slate-900">Failed orders</Text>
              <ScrollView>
                {failed.map((a) => (
                  <View key={a.id} className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
                    <Text className="font-semibold text-slate-900">{a.type}</Text>
                    <Text className="text-xs text-slate-600">Retries: {a.retryCount}</Text>
                    {a.lastError ? <Text className="mt-1 text-xs text-red-700">{a.lastError}</Text> : null}
                  </View>
                ))}
              </ScrollView>
              <Pressable onPress={() => setShowFailed(false)} className="mt-2 rounded-xl bg-slate-200 py-3">
                <Text className="text-center font-semibold text-slate-800">Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  if (syncFlash) {
    return (
      <View className="bg-emerald-600 px-4 py-2">
        <Text className="text-center text-sm font-semibold text-white">Sync complete</Text>
      </View>
    );
  }

  if (isSyncing) {
    return (
      <View className="bg-amber-500 px-4 py-2">
        <Text className="text-center text-sm font-semibold text-white">
          Syncing{pending > 0 ? ` — ${pending} pending` : ""}…
        </Text>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <Pressable onPress={() => void syncOfflineQueue()} className="bg-red-600 px-4 py-2">
        <Text className="text-center text-sm font-semibold text-white">
          You are offline — orders will sync when connected
          {pending > 0 ? ` (${pending} pending)` : ""}
        </Text>
      </Pressable>
    );
  }

  if (pending > 0) {
    return (
      <Pressable onPress={() => void syncOfflineQueue()} className="bg-amber-600 px-4 py-2">
        <Text className="text-center text-sm font-semibold text-white">
          {pending} order{pending === 1 ? "" : "s"} pending sync — tap to retry
        </Text>
      </Pressable>
    );
  }

  return null;
}
