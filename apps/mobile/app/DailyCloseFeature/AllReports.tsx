import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
} from "react-native";
import styled from "styled-components/native";
import dayjs from "dayjs";
import { Footer, Header } from "./WrapperComponents";
import { useDailyCloseStore } from "./useDailyCloseStore";
import { PrimaryButton } from "@/components/ui/Buttons";
import Dinero from "dinero.js";
import { DailyClose, Screens } from "./Types";
import {
  fetchCloseReports,
  readCachedCloseReports,
  RemoteCloseReport,
} from "./closeReportsService";

type ReportRow = {
  date: string;
  cashReceived: number;
  bankTransfersReceived: number;
  deliveryCashPaid: number;
  otherCashExpenses: number;
  source: "synced" | "local";
};

const toMoney = (amount: number) =>
  Dinero({ amount, currency: "MXN" }).toFormat("$0,0.00");

const localToReportRow = (close: DailyClose): ReportRow => ({
  date: close.date,
  cashReceived: close.cashReceived,
  bankTransfersReceived: close.bankTransfersReceived,
  deliveryCashPaid: close.deliveryCashPaid,
  otherCashExpenses: close.otherCashExpenses,
  source: "local",
});

const remoteToReportRow = (close: RemoteCloseReport): ReportRow => ({
  date: close.date,
  cashReceived: Number(close.cashReceived ?? 0),
  bankTransfersReceived: Number(close.bankTransfersReceived ?? 0),
  deliveryCashPaid: Number(close.deliveryCashPaid ?? 0),
  otherCashExpenses: Number(close.otherCashExpenses ?? 0),
  source: "synced",
});

export default ({
  navigation,
}: {
  navigation: { navigate: (screen: Screens) => void };
}) => {
  const closesByDate = useDailyCloseStore((state) => state.closesByDate);
  const [remoteReports, setRemoteReports] = useState<RemoteCloseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCompactHeader, setIsCompactHeader] = useState(false);

  const localRows = useMemo(
    () => Object.values(closesByDate).map(localToReportRow),
    [closesByDate],
  );

  const reportRows = useMemo(() => {
    const byDate = new Map<string, ReportRow>();

    for (const row of localRows) {
      byDate.set(row.date, row);
    }

    for (const row of remoteReports.map(remoteToReportRow)) {
      byDate.set(row.date, row);
    }

    return Array.from(byDate.values())
      .sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix())
      .slice(0, 14);
  }, [localRows, remoteReports]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const cached = await readCachedCloseReports();
      if (cached) {
        setRemoteReports(cached.reports);
        setIsCached(true);
      }

      const fresh = await fetchCloseReports(30);
      setRemoteReports(fresh.reports);
      setIsCached(false);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "No se pudo cargar historial remoto.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      setIsCompactHeader(y >= 30);
    },
    [],
  );

  const totalIncome = reportRows.reduce(
    (acc, close) => acc + close.cashReceived + close.bankTransfersReceived,
    0,
  );
  const totalOutcome = reportRows.reduce(
    (acc, close) => acc + close.deliveryCashPaid + close.otherCashExpenses,
    0,
  );

  return (
    <View style={{ flex: 1, margin: 50, marginTop: 0 }}>
      <Header
        title={"Historial de cierres!"}
        subtitle={isCompactHeader ? "" : "Sincronizado con backend"}
        compact
      />
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View
          style={{
            display: "flex",
            flex: 1,
          }}
        >
          <Label style={{ fontWeight: "600", fontSize: 18 }}>
            Ingresos por productos
          </Label>

          {loading ? (
            <StatusBox>
              <ActivityIndicator color="#334155" />
              <StatusText>Cargando historial remoto...</StatusText>
            </StatusBox>
          ) : null}

          {loadError ? (
            <StatusBox>
              <StatusText>{loadError}</StatusText>
              {isCached ? (
                <StatusText>Mostrando cache local.</StatusText>
              ) : null}
            </StatusBox>
          ) : (
            <StatusText>
              {isCached
                ? "Mostrando cache local."
                : "Historial sincronizado con backend."}
            </StatusText>
          )}

          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#00000010",
              paddingLeft: 10,
              paddingRight: 10,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
            }}
          >
            <View
              style={{ flex: 0.35, marginRight: 10, alignItems: "flex-end" }}
            >
              <Label style={{ flex: 0 }}>Fecha</Label>
            </View>
            <View style={{ flex: 0.8 }}>
              <Label style={{ flex: 3 }}>Ingresos</Label>
            </View>
            <View style={{ flex: 0.55, alignItems: "flex-end" }}>
              <Label style={{ flex: 1 }}>Egresos</Label>
            </View>
            <View style={{ flex: 0.55, alignItems: "flex-end" }}>
              <Label style={{ flex: 1 }}>Total</Label>
            </View>
            <View style={{ flex: 0.45, alignItems: "flex-end" }}>
              <Label style={{ flex: 1 }}>Origen</Label>
            </View>
          </View>

          {reportRows.map((close) => {
            const income = close.cashReceived + close.bankTransfersReceived;
            const outcome = close.deliveryCashPaid + close.otherCashExpenses;
            return (
              <View
                key={`${close.source}:${close.date}`}
                style={{
                  flexDirection: "row",
                  backgroundColor:
                    close.source === "local" ? "#fef3c710" : "#00000002",
                  paddingLeft: 10,
                  paddingRight: 10,
                  marginTop: 0,
                  marginBottom: 0,
                }}
              >
                <View
                  style={{
                    flex: 0.35,
                    marginRight: 10,
                    alignItems: "flex-end",
                  }}
                >
                  <Label style={{ flex: 0 }}>{close.date}</Label>
                </View>
                <View style={{ flex: 0.8, marginRight: 10 }}>
                  <Label style={{ flex: 3 }}>{toMoney(income)}</Label>
                </View>
                <View
                  style={{
                    flex: 0.55,
                    marginRight: 10,
                    alignItems: "flex-end",
                  }}
                >
                  <Label style={{ flex: 0 }}>{toMoney(outcome)}</Label>
                </View>
                <View
                  style={{
                    flex: 0.55,
                    marginRight: 10,
                    alignItems: "flex-end",
                  }}
                >
                  <Label style={{ flex: 1 }}>{toMoney(income - outcome)}</Label>
                </View>
                <View style={{ flex: 0.45, alignItems: "flex-end" }}>
                  <SourceLabel local={close.source === "local"}>
                    {close.source === "local" ? "Local" : "Sync"}
                  </SourceLabel>
                </View>
              </View>
            );
          })}

          {reportRows.length === 0 ? (
            <StatusBox>
              <StatusText>No hay cierres para mostrar.</StatusText>
            </StatusBox>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#00000005",
              paddingLeft: 10,
              paddingRight: 10,
              borderBottomLeftRadius: 4,
              borderBottomRightRadius: 4,
            }}
          >
            <View style={{ flex: 1, marginRight: 10, alignItems: "flex-end" }}>
              <Label style={{ flex: 0, fontWeight: "bold" }}>
                Total ingresos: {toMoney(totalIncome)} | Neto:{" "}
                {toMoney(totalIncome - totalOutcome)}
              </Label>
            </View>
          </View>
        </View>
      </ScrollView>

      <Footer>
        <PrimaryButton
          onPress={() => navigation.navigate(Screens.LandingScreen)}
        >
          Ok
        </PrimaryButton>
      </Footer>
    </View>
  );
};

const Label = styled.Text`
  color: #2d2d2dff;
  font-weight: 400;
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 16px;
`;

const StatusBox = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background-color: #ffffff;
  padding: 10px;
  margin-bottom: 10px;
`;

const StatusText = styled.Text`
  color: #475569;
  font-size: 13px;
  margin-bottom: 8px;
`;

const SourceLabel = styled.Text<{ local: boolean }>`
  color: ${({ local }) => (local ? "#92400e" : "#334155")};
  font-weight: 700;
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 13px;
`;
