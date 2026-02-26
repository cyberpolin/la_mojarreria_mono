import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { gql } from "@apollo/client";
import { Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Hint, Label } from "@/components/Typography";
import { RootStackParamList } from "./NavigationStack";
import { Screens } from "./Types";
import NumericKeypad from "@/components/ui/NumericKeyPad";
import { SecondaryButton } from "@/components/ui/Buttons";
import { client } from "@/apollo/client";
import { useInternetStatus } from "@/hooks/UseInternetStatus";
import {
  findCachedOperatorForLogin,
  syncDailyCloseOperators,
  upsertCachedOperator,
} from "./operatorCache";
import { useDailyCloseStore } from "./useDailyCloseStore";

type Props = NativeStackScreenProps<
  RootStackParamList,
  Screens.OperatorLoginScreen
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

const VALIDATE_DAILY_CLOSE_OPERATOR = gql`
  mutation ValidateDailyCloseOperator($phone: String!, $pin: String!) {
    validateDailyCloseOperator(phone: $phone, pin: $pin) {
      success
      message
      userId
      name
      phone
      role
    }
  }
`;

export default function OperatorLoginScreen({ navigation }: Props) {
  const setCloseOperator = useDailyCloseStore(
    (state) => state.setCloseOperator,
  );
  const { isInternetReachable } = useInternetStatus();

  const [activeField, setActiveField] = useState<"phone" | "pin" | null>(
    "phone",
  );
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!isInternetReachable) return;
    syncDailyCloseOperators(client).catch(() => undefined);
  }, [isInternetReachable]);

  const onKeypadPress = (key: KeypadKey) => {
    if (!activeField || isValidating) return;

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

  const canSubmitCredentials =
    phone.trim().length >= 8 && pin.length === 4 && !isValidating;

  const onSubmit = async () => {
    if (!canSubmitCredentials) return;

    setIsValidating(true);
    setAuthError(null);

    try {
      let resolved: {
        userId: string;
        name: string;
        phone: string;
        role: string | null;
        source: "online" | "offline_cache";
        raw: Record<string, unknown> | null;
      } | null = null;

      if (isInternetReachable) {
        try {
          const response = await client.mutate<{
            validateDailyCloseOperator: {
              success: boolean;
              message: string;
              userId: string | null;
              name: string | null;
              phone: string | null;
              role: string | null;
            };
          }>({
            mutation: VALIDATE_DAILY_CLOSE_OPERATOR,
            variables: {
              phone: phone.trim(),
              pin: pin.trim(),
            },
            fetchPolicy: "no-cache",
          });

          const result = response.data?.validateDailyCloseOperator;
          if (result?.success && result.userId && result.name && result.phone) {
            resolved = {
              userId: result.userId,
              name: result.name,
              phone: result.phone,
              role: result.role ?? null,
              source: "online",
              raw: {
                validation: result,
              },
            };

            await upsertCachedOperator({
              userId: result.userId,
              name: result.name,
              phone: result.phone,
              role: result.role ?? null,
              pin: pin.trim(),
              active: true,
              raw: {
                validation: result,
              },
            });
          } else if (result?.message) {
            setAuthError(result.message);
          }
        } catch {
          // offline fallback below
        }
      }

      if (!resolved) {
        const cached = await findCachedOperatorForLogin(
          phone.trim(),
          pin.trim(),
        );
        if (cached) {
          resolved = {
            userId: cached.userId,
            name: cached.name,
            phone: cached.phone,
            role: cached.role,
            source: "offline_cache",
            raw: cached.raw,
          };
        }
      }

      if (!resolved) {
        setAuthError(
          "No se pudo validar. Revisa teléfono/PIN o conecta internet.",
        );
        return;
      }

      setCloseOperator({
        userId: resolved.userId,
        name: resolved.name,
        phone: resolved.phone,
        validatedAt: dayjs().toISOString(),
      });

      navigation.navigate(Screens.DailySalesScreen);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "No se pudo validar el usuario.",
      );
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 24,
        paddingVertical: 24,
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          alignItems: "stretch",
          flex: 1,
        }}
      >
        <View style={{ flex: 1, paddingRight: 12, justifyContent: "center" }}>
          <Label>Validar operador</Label>
          <Hint>Ingresa teléfono + PIN para iniciar el cierre.</Hint>

          <View style={{ width: "100%", marginTop: 12, marginBottom: 10 }}>
            <Pressable
              onPress={() => setActiveField("phone")}
              style={{
                borderWidth: 1,
                borderColor: activeField === "phone" ? "#6b7280" : "#d1d5db",
                backgroundColor: "#f8fafc",
                borderRadius: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                marginBottom: 8,
              }}
            >
              <Hint>Teléfono</Hint>
              <Label>{phone || "Selecciona y escribe con keypad"}</Label>
            </Pressable>

            <Pressable
              onPress={() => setActiveField("pin")}
              style={{
                borderWidth: 1,
                borderColor: activeField === "pin" ? "#6b7280" : "#d1d5db",
                backgroundColor: "#f8fafc",
                borderRadius: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
              }}
            >
              <Hint>PIN (4 dígitos)</Hint>
              <Label>
                {pin
                  ? "•".repeat(pin.length)
                  : "Selecciona y escribe con keypad"}
              </Label>
            </Pressable>
          </View>

          {authError ? <Hint>{authError}</Hint> : null}

          <SecondaryButton
            onPress={() => navigation.navigate(Screens.LandingScreen)}
            style={{ marginTop: 14 }}
          >
            Volver
          </SecondaryButton>
        </View>

        <View
          style={{
            width: "45%",
            minWidth: 260,
            justifyContent: "center",
            paddingLeft: 12,
          }}
        >
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <NumericKeypad
              activeId={activeField}
              onKeyPress={onKeypadPress}
              canSubmit={canSubmitCredentials}
              onSubmit={onSubmit}
              submitLabel={isValidating ? "Validando..." : "Iniciar el cierre"}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
