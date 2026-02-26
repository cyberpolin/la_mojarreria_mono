// /src/hooks/useInternetStatus.ts
import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export type InternetStatus = {
  isConnected: boolean; // conectado a red
  isInternetReachable: boolean; // internet real
  type: string | null;
};

export const useInternetStatus = (): InternetStatus => {
  const [status, setStatus] = useState<InternetStatus>({
    isConnected: false,
    isInternetReachable: false,
    type: null,
  });

  useEffect(() => {
    // Estado inicial
    NetInfo.fetch().then((state) => {
      setStatus({
        isConnected: Boolean(state.isConnected),
        isInternetReachable: Boolean(state.isInternetReachable),
        type: state.type ?? null,
      });
    });

    // Listener de cambios
    const unsubscribe = NetInfo.addEventListener((state) => {
      setStatus({
        isConnected: Boolean(state.isConnected),
        isInternetReachable: Boolean(state.isInternetReachable),
        type: state.type ?? null,
      });
    });

    return () => unsubscribe();
  }, []);

  return status;
};
