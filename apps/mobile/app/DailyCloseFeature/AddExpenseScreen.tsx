import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { RootStackParamList } from "./NavigationStack";
import { Screens } from "./Types";
import { addExpense } from "./expensesService";

export default function AddExpenseScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await addExpense({ concept, amount });
      navigation.navigate(Screens.ExpensesListScreen);
    } catch (caught) {
      Alert.alert(
        "No se pudo guardar",
        caught instanceof Error
          ? caught.message
          : "Revisa concepto y cantidad.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate(Screens.ExpensesListScreen)}
        >
          <Ionicons name="arrow-back" size={18} color="#334155" />
          <Text style={styles.backButtonText}>Lista</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>GASTOS</Text>
        <Text style={styles.title}>Agregar gasto</Text>

        <Text style={styles.label}>Concepto</Text>
        <TextInput
          value={concept}
          onChangeText={setConcept}
          placeholder="Hielo, gas, reparacion..."
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />

        <Text style={styles.label}>Cantidad</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="#94a3b8"
          keyboardType="decimal-pad"
          style={styles.input}
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => void onSave()}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Guardando..." : "Guardar gasto"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
    minHeight: 44,
  },
  backButtonText: {
    color: "#334155",
    fontWeight: "700",
  },
  eyebrow: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 6,
    marginBottom: 24,
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "800",
  },
  label: {
    marginBottom: 8,
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    minHeight: 52,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
