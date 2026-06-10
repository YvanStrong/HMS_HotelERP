import NetInfo from "@react-native-community/netinfo";

import { useEffect } from "react";

import { useOfflineQueueStore } from "../store/offlineQueueStore";

import { syncOfflineQueue } from "./offlineSync";



export function useOfflineSync() {

  useEffect(() => {

    const unsub = NetInfo.addEventListener((state) => {

      const online = !!(state.isConnected && state.isInternetReachable !== false);

      useOfflineQueueStore.getState().setOnline(online);

      if (online) {

        void syncOfflineQueue();

      }

    });

    void NetInfo.fetch().then((state) => {

      const online = !!(state.isConnected && state.isInternetReachable !== false);

      useOfflineQueueStore.getState().setOnline(online);

    });

    return () => unsub();

  }, []);

}


