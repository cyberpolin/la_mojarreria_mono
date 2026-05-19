import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { client } from "@/apollo/client";
import { RootStackParamList } from "./NavigationStack";
import { Screens } from "./Types";
import { Hint, Label } from "@/components/Typography";
import NumericKeypad from "@/components/ui/NumericKeyPad";
import {
  OptionalButton,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/Buttons";
import { useInternetStatus } from "@/hooks/UseInternetStatus";
import {
  AttendanceAction,
  AttendanceEmployee,
  EmployeeClockRecord,
  findCachedAttendanceEmployee,
  getAllClockRecords,
  getAttendanceOutboxCount,
  recordLocalAttendanceEvent,
  syncAttendanceEmployees,
  syncAttendanceOutbox,
  validateAttendanceEmployee,
} from "./checkInOutStorage";

type Props = NativeStackScreenProps<
  RootStackParamList,
  Screens.CheckInOutScreen
>;

type KeypadKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "Del";

const formatDuration = (minutes: number) => {
  const safe = Math.max(0, minutes);
  const hrs = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hrs <= 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
};

const emptyRecord = (employee?: AttendanceEmployee): EmployeeClockRecord => ({
  status: "OUT",
  date: null,
  clockInTime: null,
  lastClockOutTime: null,
  lastShiftDurationMinutes: null,
  employeeName: employee?.name ?? "",
  employeePhone: employee?.phone ?? "",
});

export default function CheckInOutScreen({ navigation }: Props) {
  const { isInternetReachable } = useInternetStatus();

  const [records, setRecords] = useState<Record<string, EmployeeClockRecord>>(
    {},
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [activeField, setActiveField] = useState<"phone" | "pin">("phone");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [employee, setEmployee] = useState<AttendanceEmployee | null>(null);
  const [nextAction, setNextAction] = useState<AttendanceAction | null>(null);
  const [confirmationTime, setConfirmationTime] = useState("");
  const [shiftDuration, setShiftDuration] = useState("");

  useEffect(() => {
    const load = async () => {
      const [storedRecords, outboxCount] = await Promise.all([
        getAllClockRecords(),
        getAttendanceOutboxCount(),
      ]);
      setRecords(storedRecords);
      setPendingCount(outboxCount);
    };

    load();
  }, []);

  useEffect(() => {
    if (!isInternetReachable) return;

    Promise.all([syncAttendanceEmployees(client), syncAttendanceOutbox(client)])
      .then(async () => {
        const [storedRecords, outboxCount] = await Promise.all([
          getAllClockRecords(),
          getAttendanceOutboxCount(),
        ]);
        setRecords(storedRecords);
        setPendingCount(outboxCount);
      })
      .catch(() => undefined);
  }, [isInternetReachable]);

  const selectedRecord = useMemo(() => {
    if (!employee) return emptyRecord();
    return records[employee.userId] ?? emptyRecord(employee);
  }, [employee, records]);

  const pendingPreviousCheckout =
    selectedRecord.status === "IN" &&
    Boolean(selectedRecord.date) &&
    selectedRecord.date !== dayjs().format("YYYY-MM-DD");

  const canSubmitCredentials =
    phone.trim().length >= 8 && pin.length === 4 && !isBusy;

  const handleClose = () => {
    navigation.navigate(Screens.LandingScreen);
  };

  const onKeypadPress = (key: KeypadKey) => {
    if (isBusy) return;

    if (activeField === "phone") {
      setPhone((prev) => {
        if (key === "Del") return prev.slice(0, -1);
        if (prev.length >= 15) return prev;
        return prev + key;
      });
      return;
    }

    setPin((prev) => {
      if (key === "Del") return prev.slice(0, -1);
      if (prev.length >= 4) return prev;
      return prev + key;
    });
  };

  const refreshRecords = async () => {
    const [storedRecords, outboxCount] = await Promise.all([
      getAllClockRecords(),
      getAttendanceOutboxCount(),
    ]);
    setRecords(storedRecords);
    setPendingCount(outboxCount);
  };

  const validateCredentials = async () => {
    if (!canSubmitCredentials) return;

    setIsBusy(true);
    setStatusMessage(null);

    try {
      let resolvedEmployee: AttendanceEmployee | null = null;

      if (isInternetReachable) {
        const result = await validateAttendanceEmployee(
          client,
          phone.trim(),
          pin.trim(),
        );
        if (result.success && result.employee) {
          resolvedEmployee = result.employee;
        } else {
          setStatusMessage(result.message);
          return;
        }
      }

      if (!resolvedEmployee) {
        resolvedEmployee = await findCachedAttendanceEmployee(
          phone.trim(),
          pin.trim(),
        );
      }

      if (!resolvedEmployee) {
        setStatusMessage(
          "No se pudo validar. Revisa teléfono/PIN o conecta internet.",
        );
        return;
      }

      await refreshRecords();
      const currentRecord =
        (await getAllClockRecords())[resolvedEmployee.userId] ??
        emptyRecord(resolvedEmployee);
      if (
        currentRecord.status === "OUT" &&
        currentRecord.date === dayjs().format("YYYY-MM-DD") &&
        currentRecord.lastClockOutTime
      ) {
        setStatusMessage("Ya registraste entrada y salida el día de hoy.");
        return;
      }
      setEmployee(resolvedEmployee);
      setNextAction(currentRecord.status === "IN" ? "CHECK_OUT" : "CHECK_IN");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "No se pudo validar el empleado.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const continueAction = async () => {
    if (isBusy) return;
    if (!employee || !nextAction) return;

    setIsBusy(true);
    setStatusMessage(null);

    try {
      const result = await recordLocalAttendanceEvent(employee, nextAction);
      await refreshRecords();

      if (isInternetReachable) {
        const syncResult = await syncAttendanceOutbox(client);
        setPendingCount(syncResult.pending);
      } else {
        const outboxCount = await getAttendanceOutboxCount();
        setPendingCount(outboxCount);
      }

      setConfirmationTime(dayjs(result.occurredAt).format("HH:mm"));
      setShiftDuration(
        result.durationMinutes === null
          ? ""
          : formatDuration(result.durationMinutes),
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "No se pudo registrar la asistencia.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const resetForm = () => {
    setEmployee(null);
    setNextAction(null);
    setPhone("");
    setPin("");
    setConfirmationTime("");
    setShiftDuration("");
    setStatusMessage(null);
    setActiveField("phone");
  };

  const actionLabel = nextAction === "CHECK_OUT" ? "Salida" : "Entrada";
  const isConfirmed = Boolean(confirmationTime);

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View
        style={{
          paddingHorizontal: 18,
          paddingTop: 38,
          paddingBottom: 12,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Hint>{isInternetReachable ? "Online" : "Offline"}</Hint>
          {pendingCount > 0 ? <Hint>{pendingCount} pendiente(s)</Hint> : null}
        </View>
        <SecondaryButton
          onPress={handleClose}
          style={{ margin: 0, height: 36 }}
          textStyle={{ fontSize: 12 }}
        >
          Cerrar
        </SecondaryButton>
      </View>

      <View
        style={{
          flex: 1,
          flexDirection: "row",
          paddingHorizontal: 18,
          paddingBottom: 18,
        }}
      >
        <ScrollView
          style={{ flex: 0.58, marginRight: 12 }}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {!employee ? (
            <>
              <Label>Entrada / Salida</Label>
              <Hint>Ingresa tu teléfono y PIN para registrar asistencia.</Hint>

              <Pressable
                onPress={() => setActiveField("phone")}
                style={{
                  marginTop: 14,
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: activeField === "phone" ? "#64748b" : "#cbd5e1",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <Hint>Teléfono</Hint>
                <Label>{phone || "Selecciona y escribe con keypad"}</Label>
              </Pressable>

              <Pressable
                onPress={() => setActiveField("pin")}
                style={{
                  marginTop: 10,
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: activeField === "pin" ? "#64748b" : "#cbd5e1",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <Hint>PIN</Hint>
                <Label>{pin ? "•".repeat(pin.length) : "4 dígitos"}</Label>
              </Pressable>

              {statusMessage ? (
                <Hint style={{ marginTop: 10 }}>{statusMessage}</Hint>
              ) : null}
            </>
          ) : null}

          {employee && !isConfirmed ? (
            <>
              <Label>{employee.name}</Label>
              <Hint>
                Acción detectada: {actionLabel}
                {pendingPreviousCheckout ? " pendiente de un día anterior" : ""}
              </Hint>

              <View
                style={{
                  marginTop: 14,
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#cbd5e1",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <Hint>Teléfono: {employee.phone}</Hint>
                <Hint>Dispositivo: {employee.deviceId}</Hint>
                {selectedRecord.status === "IN" &&
                selectedRecord.clockInTime ? (
                  <Hint>
                    Entrada abierta:{" "}
                    {dayjs(selectedRecord.clockInTime).format(
                      "YYYY-MM-DD HH:mm",
                    )}
                  </Hint>
                ) : (
                  <Hint>Sin entrada abierta</Hint>
                )}
              </View>

              {pendingPreviousCheckout ? (
                <Hint style={{ marginTop: 10 }}>
                  Primero se registrará la salida pendiente. Después podrás
                  volver a entrar.
                </Hint>
              ) : null}

              {statusMessage ? (
                <Hint style={{ marginTop: 10 }}>{statusMessage}</Hint>
              ) : null}
            </>
          ) : null}

          {employee && isConfirmed ? (
            <>
              <Label>{actionLabel} confirmada</Label>
              <Hint>Empleado: {employee.name}</Hint>
              <Hint>Hora: {confirmationTime}</Hint>
              {shiftDuration ? <Hint>Duración: {shiftDuration}</Hint> : null}
              {pendingCount > 0 ? (
                <Hint>Se sincronizará cuando haya internet.</Hint>
              ) : (
                <Hint>Sincronizado o guardado localmente.</Hint>
              )}
            </>
          ) : null}
        </ScrollView>

        <View
          style={{
            flex: 0.42,
            minWidth: 280,
            backgroundColor: "#ffffff",
            borderWidth: 1,
            borderColor: "#cbd5e1",
            borderRadius: 12,
            padding: 12,
            justifyContent: "center",
          }}
        >
          {!employee ? (
            <View style={{ alignItems: "center" }}>
              <NumericKeypad
                activeId={activeField}
                onKeyPress={onKeypadPress}
                canSubmit={canSubmitCredentials}
                onSubmit={validateCredentials}
                submitLabel={isBusy ? "Validando..." : "Validar"}
              />
              <OptionalButton onPress={handleClose}>Cancelar</OptionalButton>
            </View>
          ) : null}

          {employee && !isConfirmed ? (
            <>
              <PrimaryButton onPress={continueAction}>
                {isBusy ? "Guardando..." : `Registrar ${actionLabel}`}
              </PrimaryButton>
              <OptionalButton onPress={resetForm}>
                Cambiar usuario
              </OptionalButton>
            </>
          ) : null}

          {employee && isConfirmed ? (
            <PrimaryButton onPress={resetForm}>Listo</PrimaryButton>
          ) : null}
        </View>
      </View>
    </View>
  );
}
