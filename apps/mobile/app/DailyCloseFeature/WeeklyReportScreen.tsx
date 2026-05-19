import React, { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Screens } from "./Types";
import type { RootStackParamList } from "./NavigationStack";
import {
  addDays,
  fetchWeeklyReport,
  fromDateInput,
  getCurrentWeekStart,
  readCachedWeeklyReport,
  toDateInput,
  WeeklyReportPayload,
} from "./weeklyReportService";

const toMoney = (value: number) => `$${(value / 100).toFixed(2)}`;

const moneyTone = (value: number) =>
  value < 0 ? styles.negativeText : styles.valueText;

const dayName = (date: string) =>
  fromDateInput(date).toLocaleDateString("es-MX", { weekday: "short" });

const MetricCard = ({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, danger ? styles.negativeText : null]}>
      {value}
    </Text>
  </View>
);

export default function WeeklyReportScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart());
  const [report, setReport] = useState<WeeklyReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(
    async ({
      showLoading = true,
      week = weekStart,
    }: {
      showLoading?: boolean;
      week?: string;
    } = {}) => {
      if (showLoading) setLoading(true);
      setError(null);

      try {
        const cached = await readCachedWeeklyReport(week);
        if (cached) {
          setReport(cached);
          setIsCached(true);
        }

        const fresh = await fetchWeeklyReport(week);
        setReport(fresh);
        setIsCached(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el reporte semanal.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [weekStart],
  );

  useEffect(() => {
    void loadReport({ week: weekStart });
  }, [loadReport, weekStart]);

  const moveWeek = (days: number) => {
    setWeekStart(toDateInput(addDays(fromDateInput(weekStart), days)));
  };

  const refresh = () => {
    setRefreshing(true);
    void loadReport({ showLoading: false, week: weekStart });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate(Screens.LandingScreen)}
        >
          <Ionicons name="arrow-back" size={18} color="#334155" />
          <Text style={styles.backButtonText}>Home</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>MOJARRERIA REPORTS</Text>
        <Text style={styles.title}>Weekly Report</Text>
        <Text style={styles.subtitle}>
          Monday {report?.weekStart ?? weekStart} to Sunday{" "}
          {report?.weekEnd ?? toDateInput(addDays(fromDateInput(weekStart), 6))}
        </Text>
      </View>

      <View style={styles.weekControls}>
        <TouchableOpacity
          style={styles.weekButton}
          onPress={() => moveWeek(-7)}
        >
          <Text style={styles.weekButtonText}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.weekButton}
          onPress={() => setWeekStart(getCurrentWeekStart())}
        >
          <Text style={styles.weekButtonText}>Current</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.weekButton} onPress={() => moveWeek(7)}>
          <Text style={styles.weekButtonText}>Next</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color="#0f172a" />
          <Text style={styles.stateText}>Loading weekly report...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Report issue</Text>
          <Text style={styles.errorText}>{error}</Text>
          {isCached ? (
            <Text style={styles.errorText}>Showing cached data.</Text>
          ) : null}
        </View>
      ) : null}

      {report ? (
        <>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>
              {isCached ? "Cached/offline" : "Fresh data"} · Updated{" "}
              {new Date(report.fetchedAt).toLocaleString("es-MX", {
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>

          <View style={styles.metrics}>
            <MetricCard label="Sales" value={toMoney(report.totals.sales)} />
            <MetricCard
              label="Expenses"
              value={toMoney(report.totals.expenseTotal)}
            />
            <MetricCard
              label="Rough"
              value={toMoney(report.totals.roughEarnings)}
              danger={report.totals.roughEarnings < 0}
            />
            <MetricCard
              label="Cash"
              value={toMoney(report.totals.cashBalance)}
              danger={report.totals.cashBalance < 0}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Monday to Sunday</Text>
            {report.rows.map((row) => (
              <View key={row.date} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>
                    {dayName(row.date)} {row.date}
                  </Text>
                  <Text style={styles.dayMeta}>{row.closes} closes</Text>
                </View>
                <View style={styles.dayGrid}>
                  <View>
                    <Text style={styles.fieldLabel}>Sales</Text>
                    <Text style={styles.valueText}>{toMoney(row.sales)}</Text>
                  </View>
                  <View>
                    <Text style={styles.fieldLabel}>Expenses</Text>
                    <Text style={styles.valueText}>
                      {toMoney(row.expenseTotal)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.fieldLabel}>Rough</Text>
                    <Text style={moneyTone(row.roughEarnings)}>
                      {toMoney(row.roughEarnings)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.fieldLabel}>Cash</Text>
                    <Text style={moneyTone(row.cashBalance)}>
                      {toMoney(row.cashBalance)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Expenses</Text>
            {report.topExpenses.length > 0 ? (
              report.topExpenses.map((expense) => (
                <View key={expense.id} style={styles.expenseRow}>
                  <View style={styles.expenseText}>
                    <Text style={styles.expenseConcept}>{expense.concept}</Text>
                    <Text style={styles.expenseMeta}>
                      {expense.date}
                      {expense.notes ? ` · ${expense.notes}` : ""}
                    </Text>
                  </View>
                  <Text style={styles.expenseAmount}>
                    {toMoney(expense.amountCents)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No expenses for this week.</Text>
              </View>
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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
    textTransform: "uppercase",
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
  weekControls: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  weekButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  weekButtonText: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 13,
  },
  stateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 14,
  },
  stateText: {
    color: "#334155",
    fontWeight: "600",
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    padding: 14,
    marginBottom: 14,
  },
  errorTitle: {
    color: "#7f1d1d",
    fontWeight: "800",
  },
  errorText: {
    marginTop: 4,
    color: "#991b1b",
  },
  statusRow: {
    marginBottom: 10,
  },
  statusText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  metricCard: {
    width: "47.8%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    padding: 14,
  },
  metricLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricValue: {
    marginTop: 6,
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
  },
  section: {
    marginTop: 4,
    marginBottom: 18,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 10,
  },
  dayCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 10,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  dayTitle: {
    color: "#0f172a",
    fontWeight: "800",
    textTransform: "capitalize",
  },
  dayMeta: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  fieldLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  valueText: {
    marginTop: 3,
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 14,
  },
  negativeText: {
    marginTop: 3,
    color: "#b91c1c",
    fontWeight: "800",
    fontSize: 14,
  },
  expenseRow: {
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
  },
  expenseText: {
    flex: 1,
  },
  expenseConcept: {
    color: "#0f172a",
    fontWeight: "800",
  },
  expenseMeta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },
  expenseAmount: {
    color: "#0f172a",
    fontWeight: "800",
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    padding: 14,
  },
  emptyText: {
    color: "#64748b",
    fontWeight: "600",
  },
});
