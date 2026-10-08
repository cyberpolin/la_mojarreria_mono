import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import * as ScreenOrientation from "expo-screen-orientation";

export function useLockedOrientation(lock: ScreenOrientation.OrientationLock) {
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(lock).catch(() => undefined);
    }, [lock]),
  );
}
