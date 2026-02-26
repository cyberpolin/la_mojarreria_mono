import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "./NavigationStack";
import { Screens } from "./Types";
import { Hint, Label } from "@/components/Typography";
import NumericKeypad from "@/components/ui/NumericKeyPad";
import {
  OptionalButton,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/Buttons";
import { getCachedOperators } from "./operatorCache";
import {
  getAllClockRecords,
  upsertClockRecordByUserId,
} from "./checkInOutStorage";

type Props = NativeStackScreenProps<
  RootStackParamList,
  Screens.CheckInOutScreen
>;

type Employee = {
  userId: string;
  name: string;
  pin: string;
  active: boolean;
};

type ClockRecord = {
  status: "IN" | "OUT";
  clockInTime: string | null;
  lastClockOutTime: string | null;
  lastShiftDurationMinutes: number | null;
};

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

const getProgressStep = (
  step: number,
  action: "CHECK_IN" | "CHECK_OUT" | null,
) => {
  if (step <= 3) return step;
  if (step === 4 && action === "CHECK_IN") return 4;
  if (step === 5 && action === "CHECK_OUT") return 5;
  return 4;
};

export default function CheckInOutScreen({ navigation }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clockRecords, setClockRecords] = useState<Record<string, ClockRecord>>(
    {},
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [nextAction, setNextAction] = useState<"CHECK_IN" | "CHECK_OUT" | null>(
    null,
  );
  const [confirmationTime, setConfirmationTime] = useState<string>("");
  const [shiftDuration, setShiftDuration] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const [cached, records] = await Promise.all([
        getCachedOperators(),
        getAllClockRecords(),
      ]);
      const activeEmployees = cached
        .filter((item) => item.active)
        .map((item) => ({
          userId: item.userId,
          name: item.name,
          pin: item.pin,
          active: item.active,
        }));
      setEmployees(activeEmployees);
      setClockRecords(records as Record<string, ClockRecord>);
    };

    load();
  }, []);

  const selectedEmployee = useMemo(
    () =>
      employees.find((employee) => employee.userId === selectedEmployeeId) ??
      null,
    [employees, selectedEmployeeId],
  );

  const selectedRecord: ClockRecord = useMemo(() => {
    if (!selectedEmployeeId) {
      return {
        status: "OUT",
        clockInTime: null,
        lastClockOutTime: null,
        lastShiftDurationMinutes: null,
      };
    }

    return (
      clockRecords[selectedEmployeeId] ?? {
        status: "OUT",
        clockInTime: null,
        lastClockOutTime: null,
        lastShiftDurationMinutes: null,
      }
    );
  }, [clockRecords, selectedEmployeeId]);

  const handleClose = () => {
    navigation.navigate(Screens.LandingScreen);
  };

  const handleSelectEmployee = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setPin("");
    setPinError(null);
    setStep(2);
  };

  const onPinKeyPress = (key: KeypadKey) => {
    setPin((prev) => {
      if (key === "Del") return prev.slice(0, -1);
      if (prev.length >= 4) return prev;
      return prev + key;
    });
  };

  const verifyPin = () => {
    if (!selectedEmployee) return;
    if (pin.length !== 4) {
      setPinError("PIN incompleto.");
      return;
    }

    if (pin !== selectedEmployee.pin) {
      setPinError("PIN incorrecto.");
      return;
    }

    setPinError(null);
    setNextAction(selectedRecord.status === "IN" ? "CHECK_OUT" : "CHECK_IN");
    setStep(3);
  };

  const continueAction = async () => {
    if (!selectedEmployee || !nextAction) return;

    const nowIso = new Date().toISOString();
    const nowClock = dayjs(nowIso).format("HH:mm");

    if (nextAction === "CHECK_IN") {
      const nextRecord: ClockRecord = {
        status: "IN",
        clockInTime: nowIso,
        lastClockOutTime: selectedRecord.lastClockOutTime,
        lastShiftDurationMinutes: selectedRecord.lastShiftDurationMinutes,
      };
      const nextRecords = await upsertClockRecordByUserId(
        selectedEmployee.userId,
        nextRecord,
      );
      setClockRecords(nextRecords as Record<string, ClockRecord>);
      setConfirmationTime(nowClock);
      setStep(4);
      return;
    }

    const clockInTime = selectedRecord.clockInTime
      ? dayjs(selectedRecord.clockInTime)
      : null;
    const durationMinutes =
      clockInTime && clockInTime.isValid()
        ? Math.max(0, dayjs(nowIso).diff(clockInTime, "minute"))
        : 0;

    const nextRecord: ClockRecord = {
      status: "OUT",
      clockInTime: null,
      lastClockOutTime: nowIso,
      lastShiftDurationMinutes: durationMinutes,
    };
    const nextRecords = await upsertClockRecordByUserId(
      selectedEmployee.userId,
      nextRecord,
    );
    setClockRecords(nextRecords as Record<string, ClockRecord>);
    setConfirmationTime(nowClock);
    setShiftDuration(formatDuration(durationMinutes));
    setStep(5);
  };

  const resetAndClose = () => {
    setSelectedEmployeeId(null);
    setPin("");
    setPinError(null);
    setNextAction(null);
    setConfirmationTime("");
    setShiftDuration("");
    setStep(1);
    handleClose();
  };

  const progressStep = getProgressStep(step, nextAction);

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
        <Hint>Step {progressStep} of 5</Hint>
        <SecondaryButton
          onPress={handleClose}
          style={{ margin: 0, height: 36 }}
          textStyle={{ fontSize: 12 }}
        >
          Close
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
          {step === 1 ? (
            <>
              <Label>Check In / Check Out</Label>
              <Hint>Select your name to continue.</Hint>

              <View style={{ marginTop: 12 }}>
                {employees.map((employee) => {
                  const record =
                    clockRecords[employee.userId] ??
                    ({
                      status: "OUT",
                      clockInTime: null,
                      lastClockOutTime: null,
                      lastShiftDurationMinutes: null,
                    } as ClockRecord);

                  return (
                    <Pressable
                      key={employee.userId}
                      onPress={() => handleSelectEmployee(employee.userId)}
                      style={{
                        backgroundColor: "#ffffff",
                        borderWidth: 1,
                        borderColor: "#cbd5e1",
                        borderRadius: 12,
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        marginBottom: 10,
                      }}
                    >
                      <Label>{employee.name}</Label>
                      <Hint>Status: {record.status}</Hint>
                      {record.status === "IN" && record.clockInTime ? (
                        <Hint>
                          Working since{" "}
                          {dayjs(record.clockInTime).format("HH:mm")}
                        </Hint>
                      ) : (
                        <Hint>Not working</Hint>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Label>Verify identity</Label>
              <Hint>Enter your 4-digit PIN.</Hint>

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
                <Hint>PIN (4 digits)</Hint>
                <Hint style={{ marginTop: 2 }}>
                  (info: This confirms it’s really you.)
                </Hint>
                <Label>
                  {pin
                    ? "•".repeat(pin.length)
                    : "Selecciona y escribe con keypad"}
                </Label>
              </View>

              {pinError ? (
                <Hint style={{ marginTop: 8 }}>{pinError}</Hint>
              ) : null}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Label>Confirm action</Label>
              <Hint>
                The system will automatically check you in or check you out
                based on your current status.
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
                <Hint>
                  Action:{" "}
                  {selectedRecord.status === "IN" ? "Check Out" : "Check In"}
                </Hint>
              </View>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Label>Check In confirmed</Label>
              <Hint>You are now clocked in.</Hint>
              <Hint>Time: {confirmationTime}</Hint>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <Label>Check Out confirmed</Label>
              <Hint>You are now clocked out.</Hint>
              <Hint>Time: {confirmationTime}</Hint>
              <Hint>Shift duration: {shiftDuration}</Hint>
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
          {step === 1 ? (
            <>
              <Hint>Select an employee from the left list.</Hint>
              <OptionalButton onPress={handleClose}>Cancel</OptionalButton>
            </>
          ) : null}

          {step === 2 ? (
            <View style={{ alignItems: "center" }}>
              <NumericKeypad
                activeId="pin"
                onKeyPress={onPinKeyPress}
                canSubmit={pin.length === 4}
                onSubmit={verifyPin}
                submitLabel="Confirm"
              />
            </View>
          ) : null}

          {step === 3 ? (
            <PrimaryButton onPress={continueAction}>Continue</PrimaryButton>
          ) : null}
          {step === 4 ? (
            <PrimaryButton onPress={resetAndClose}>Done</PrimaryButton>
          ) : null}
          {step === 5 ? (
            <PrimaryButton onPress={resetAndClose}>Done</PrimaryButton>
          ) : null}
        </View>
      </View>
    </View>
  );
}
