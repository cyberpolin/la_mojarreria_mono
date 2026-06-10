import { useEffect, useMemo, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDailyCloseStore } from "./useDailyCloseStore";
import { subscribeToWaServiceStatus } from "@/utils/waServiceStatusStore";

const SWIPE_OPEN_THRESHOLD = 20;

const SyncStatusBar = ({ onSwipeDown }: { onSwipeDown?: () => void }) => {
  const shouldSync = useDailyCloseStore((s) => s.shouldSync());
  const [isWaServiceResponding, setIsWaServiceResponding] = useState(false);

  useEffect(
    () =>
      subscribeToWaServiceStatus((status) => {
        setIsWaServiceResponding(Boolean(status?.active && status.connected));
      }),
    [],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dy) > 4,
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dy > SWIPE_OPEN_THRESHOLD) {
            onSwipeDown?.();
          }
        },
      }),
    [onSwipeDown],
  );

  return (
    <View style={[styles.container]} {...panResponder.panHandlers}>
      <View style={styles.iconRow}>
        {isWaServiceResponding ? (
          <Ionicons
            name="logo-whatsapp"
            size={16}
            color="#2DC66E"
            style={styles.iconShadow}
          />
        ) : null}
        <Ionicons
          name={shouldSync ? "cloud-upload-outline" : "cloud-done-outline"}
          size={16}
          color={shouldSync ? "#BA372A" : "#2DC66E"}
          style={styles.iconShadow}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#00000008",
    position: "absolute",
    top: 0,
    width: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
    height: 25,
    borderBottomColor: "#00000010",
    borderBottomWidth: 1,
    paddingHorizontal: "3%",
  },
  iconShadow: {
    textShadowColor: "#00000036",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    elevation: 2,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});

export default SyncStatusBar;
