import React, { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { RootStackParamList } from "./NavigationStack";
import { Screens } from "./Types";
import {
  centsToMoney,
  loadExpenses,
  type DailyExpense,
} from "./expensesService";

export default function ExpensesListScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setExpenses(await loadExpenses());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar los gastos.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const total = expenses.reduce((sum, item) => sum + item.amountCents, 0);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load({ silent: true });
            }}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              navigation.navigate(Screens.ConversationMobileScreen)
            }
          >
            <Ionicons name="arrow-back" size={18} color="#334155" />
            <Text style={styles.backButtonText}>Menu</Text>
          </TouchableOpacity>
          <Text style={styles.eyebrow}>MOJARRERIA</Text>
          <Text style={styles.title}>Gastos</Text>
          <Text style={styles.subtitle}>
            {expenses.length} registros · {centsToMoney(total)}
          </Text>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#0f172a" />
            <Text style={styles.stateText}>Cargando gastos...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No se pudo sincronizar</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading && expenses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Aun no hay gastos.</Text>
          </View>
        ) : null}

        {expenses.map((expense) => (
          <View key={expense.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.concept}>{expense.concept}</Text>
              <Text style={styles.meta}>
                {expense.date}
                {expense.synced ? "" : " · pendiente"}
              </Text>
            </View>
            <Text style={styles.amount}>
              {centsToMoney(expense.amountCents)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate(Screens.AddExpenseScreen)}
        >
          <Text style={styles.addButtonText}>Agregar gasto</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 18,
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
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 6,
    color: "#475569",
    fontSize: 14,
  },
  stateCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    padding: 16,
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  stateText: {
    color: "#475569",
    fontWeight: "600",
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 12,
  },
  errorTitle: {
    color: "#0f172a",
    fontWeight: "800",
  },
  errorText: {
    marginTop: 4,
    color: "#475569",
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  emptyText: {
    color: "#475569",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 10,
    minHeight: 64,
  },
  rowText: {
    flex: 1,
  },
  concept: {
    color: "#0f172a",
    fontWeight: "800",
  },
  meta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },
  amount: {
    color: "#0f172a",
    fontWeight: "800",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  addButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
