import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Alert, SafeAreaView, View } from "react-native";
import { Clock, Hint, Label } from "@/components/Typography";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "./NavigationStack";
import {
  OptionalButton,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/Buttons";
import { Screens } from "./Types";
import { canStartDailyClose } from "./helpers";
import { useDailyCloseStore } from "./useDailyCloseStore";
import { hasCachedOperators } from "./operatorCache";
import { APP_CONFIG } from "@/constants/config";

const SKIP_OPERATOR_LOGIN = true;

type Props = NativeStackScreenProps<
  RootStackParamList,
  Screens.PortraitLandingScreen
>;

export default function PortraitLandingScreen(props: Props) {
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

  const closesByDate = useDailyCloseStore((state) => state.closesByDate);
  const setCloseOperator = useDailyCloseStore(
    (state) => state.setCloseOperator,
  );
  const todayDateString = dayjs().format("YYYY-MM-DD");
  const isAlreadyClosed = Object.keys(closesByDate).includes(todayDateString);
  const [isCheckingOperators, setIsCheckingOperators] = useState(false);

  const onStartClose = async () => {
    if (isCheckingOperators) return;
    if (!canStartDailyClose()) {
      Alert.alert(
        "Cierre no disponible",
        "El cierre solo puede iniciarse a partir de las 5:00pm.",
      );
      return;
    }

    if (SKIP_OPERATOR_LOGIN) {
      setCloseOperator({
        userId: APP_CONFIG.bootstrapTeamUser.userId,
        name: APP_CONFIG.bootstrapTeamUser.name,
        phone: APP_CONFIG.bootstrapTeamUser.phone,
        validatedAt: dayjs().toISOString(),
      });
      navigate(Screens.PortraitDailyCloseWizardScreen);
      return;
    }

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
      navigate(Screens.OperatorLoginScreen, {
        layout: "portrait",
        nextScreen: Screens.PortraitDailyCloseWizardScreen,
      });
    } finally {
      setIsCheckingOperators(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
      >
        <Label>La Mojarreria!</Label>
        <Clock style={{ fontSize: 64, lineHeight: 72 }}>{time}</Clock>
        <View
          style={{
            marginTop: 20,
            marginBottom: 20,
            alignItems: "center",
            paddingHorizontal: 12,
          }}
        >
          <Hint style={{ textAlign: "center" }}>
            {APP_CONFIG.env === "development"
              ? "Vas a tomar las 4 fotos de evidencia."
              : "Recuerda que solo se puede hacer el cierre a partir de las 5:00pm"}
          </Hint>
          {isAlreadyClosed ? (
            <Hint style={{ textAlign: "center", marginTop: 8 }}>
              El cierre de hoy ya se ha realizado.
            </Hint>
          ) : null}
        </View>
        {!isAlreadyClosed ? (
          <PrimaryButton onPress={onStartClose}>
            Iniciar el cierre
          </PrimaryButton>
        ) : (
          <OptionalButton onPress={() => alert("Aun no esta implementado...")}>
            Ver el resumen de hoy!
          </OptionalButton>
        )}
        <SecondaryButton
          style={{ marginTop: 24 }}
          textStyle={{ fontSize: 12 }}
          onPress={() => navigate(Screens.AllReportsScreen)}
        >
          Ver cierres anteriores
        </SecondaryButton>
      </View>
    </SafeAreaView>
  );
}
