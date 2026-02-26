import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Screens } from "./Types";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;

const IconTile = ({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress}>
      <Ionicons name={icon} size={34} color="#111827" />
      <Text style={styles.tileLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

export default function TopActionDrawer({ visible, onClose }: Props) {
  const navigation = useNavigation<any>();
  const translateY = useRef(new Animated.Value(-SCREEN_HEIGHT)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [translateY, visible]);

  if (!visible) return null;

  const openEmployeesAssistant = () => {
    onClose();
    navigation.navigate(Screens.EmployeeAssistantStep1Screen);
  };

  const openCheckInOut = () => {
    onClose();
    navigation.navigate(Screens.CheckInOutScreen);
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Acciones</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={26} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          <IconTile
            icon="timer-outline"
            label="Check In / Out"
            onPress={openCheckInOut}
          />
          <IconTile
            icon="people-outline"
            label="Employees Assistant"
            onPress={openEmployeesAssistant}
          />
          <IconTile icon="cube-outline" label="Inventario" onPress={onClose} />
          <IconTile
            icon="bar-chart-outline"
            label="Reportes"
            onPress={onClose}
          />
          <IconTile icon="settings-outline" label="Ajustes" onPress={onClose} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#00000066",
  },
  sheet: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#f8fafc",
    paddingTop: 56,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  closeButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  tile: {
    width: 150,
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  tileLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    color: "#111827",
  },
});
