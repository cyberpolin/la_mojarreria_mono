type WaServiceStatus = {
  active: boolean;
  connected: boolean;
};

type Listener = (status: WaServiceStatus | null) => void;

let currentStatus: WaServiceStatus | null = null;
const listeners = new Set<Listener>();

export const getWaServiceStatus = () => currentStatus;

export const setWaServiceStatus = (status: WaServiceStatus | null) => {
  currentStatus = status;
  for (const listener of listeners) {
    listener(status);
  }
};

export const subscribeToWaServiceStatus = (listener: Listener) => {
  listeners.add(listener);
  listener(currentStatus);

  return () => {
    listeners.delete(listener);
  };
};
