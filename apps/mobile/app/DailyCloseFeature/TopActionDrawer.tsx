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
  fullWidth = false,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  fullWidth?: boolean;
  disabled?: boolean;
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.tile,
        fullWidth ? styles.tileFull : null,
        disabled ? styles.tileDisabled : null,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.2}
    >
      <Ionicons
        name={icon}
        size={fullWidth ? 28 : 34}
        color={disabled ? "#94a3b8" : "#111827"}
      />
      <Text
        style={[
          styles.tileLabel,
          fullWidth ? styles.tileLabelFull : null,
          disabled ? styles.tileLabelDisabled : null,
        ]}
      >
        {label}
      </Text>
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

  const openActivePromos = () => {
    onClose();
    navigation.navigate(Screens.ActivePromosScreen);
  };

  const openWhatsAppInbox = () => {
    onClose();
    navigation.navigate(Screens.ConversationMobileScreen);
  };

  const openDailyClose = () => {
    onClose();
    navigation.navigate(Screens.PortraitLandingScreen);
  };

  const openWeeklyReport = () => {
    onClose();
    navigation.navigate(Screens.WeeklyReportScreen);
  };

  const openExpenses = () => {
    onClose();
    navigation.navigate(Screens.ExpensesListScreen);
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
            fullWidth
            icon="cash-outline"
            label="Cierre del día"
            onPress={openDailyClose}
          />
          <IconTile
            fullWidth
            icon="logo-whatsapp"
            label="WhatsApp"
            onPress={openWhatsAppInbox}
          />
          <IconTile
            fullWidth
            icon="receipt-outline"
            label="Gastos"
            onPress={openExpenses}
          />
          <IconTile
            disabled
            icon="timer-outline"
            label="Check In / Out"
            onPress={openCheckInOut}
          />
          <IconTile
            disabled
            icon="people-outline"
            label="Employees Assistant"
            onPress={openEmployeesAssistant}
          />
          <IconTile
            disabled
            icon="pricetag-outline"
            label="Active Promos"
            onPress={openActivePromos}
          />
          <IconTile
            disabled
            icon="cube-outline"
            label="Inventario"
            onPress={onClose}
          />
          <IconTile
            disabled
            icon="bar-chart-outline"
            label="Weekly Report"
            onPress={openWeeklyReport}
          />
          <IconTile
            disabled
            icon="settings-outline"
            label="Ajustes"
            onPress={onClose}
          />
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
  tileFull: {
    width: "100%",
    minHeight: 88,
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    gap: 12,
  },
  tileLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    color: "#111827",
  },
  tileLabelFull: {
    marginTop: 0,
    fontSize: 16,
    textAlign: "left",
  },
  tileDisabled: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
    opacity: 0.55,
  },
  tileLabelDisabled: {
    color: "#94a3b8",
  },
});
