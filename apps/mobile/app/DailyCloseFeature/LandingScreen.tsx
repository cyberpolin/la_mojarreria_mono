import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Alert, View } from "react-native";
import { Clock, Hint, Label } from "@/components/Typography";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "./NavigationStack";
import {
  OptionalButton,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/Buttons";
import { Screens } from "./Types";
import { useDailyCloseStore } from "./useDailyCloseStore";
import { hasCachedOperators } from "./operatorCache";

// TODO: Add time to access restriction

type Props = NativeStackScreenProps<RootStackParamList, Screens.LandingScreen>;

export default function LandingScreen(props: Props) {
  const {
    navigation: { navigate },
  } = props;

  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const setClock = () => setTime(dayjs().format("HH:mm"));

    setClock();
    const id = setInterval(setClock, 1000 * 60);
    return () => clearInterval(id);
  }, []);

  const isAfterFivePm = () => {
    if (!time) return false;
    const [hours, minutes] = time.split(":").map(Number);
    return hours > 17 || (hours === 17 && minutes >= 0);
  };

  const closesByDate = useDailyCloseStore((state) => state.closesByDate);
  const todayDateString = dayjs().format("YYYY-MM-DD");
  const isAlreadyClosed = Object.keys(closesByDate).includes(todayDateString);
  const [isCheckingOperators, setIsCheckingOperators] = useState(false);

  const onStartClose = async () => {
    if (isCheckingOperators) return;
    setIsCheckingOperators(true);
    try {
      const hasOperators = await hasCachedOperators();
      if (!hasOperators) {
        Alert.alert(
          "Sin usuarios de cierre",
          "No hay usuarios del equipo disponibles. Por favor contacta soporte.",
        );
        return;
      }
      navigate(Screens.OperatorLoginScreen);
    } finally {
      setIsCheckingOperators(false);
    }
  };

  const mainScreen = (
    <>
      <Label>La Mojarreria!</Label>
      <Clock>{time}</Clock>
      <View style={{ marginTop: 20, marginBottom: 20, alignItems: "center" }}>
        <Hint>
          Recuerda que solo se puede hacer el cierre despues de las 5:00pm
        </Hint>
        {isAlreadyClosed && <Hint>El cierre de hoy ya se ha realizado.</Hint>}
      </View>
      {!isAlreadyClosed ? (
        <PrimaryButton onPress={onStartClose}>Iniciar el cierre</PrimaryButton>
      ) : !isAfterFivePm() || isAlreadyClosed ? (
        <OptionalButton onPress={() => alert("Aun no esta implementado...")}>
          Ver el resumen de hoy!
        </OptionalButton>
      ) : null}
      <SecondaryButton
        style={{ marginTop: 12 }}
        textStyle={{ fontSize: 12 }}
        onPress={() => {
          throw new Error("Sentry test error from LandingScreen");
        }}
      >
        Trigger error
      </SecondaryButton>

      <SecondaryButton
        style={{
          position: "absolute",
          top: 40,
          right: 20,
        }}
        textStyle={{ fontSize: 12 }}
        onPress={() => navigate(Screens.AllReportsScreen)}
      >
        Ver cierres anteriores
      </SecondaryButton>
    </>
  );

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {mainScreen}
    </View>
  );
}
