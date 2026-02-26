import React from "react";
import { View } from "react-native";
import { Label, Hint } from "@/components/Typography";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "./NavigationStack";
import { Screens } from "./Types";

type Props = NativeStackScreenProps<
  RootStackParamList,
  Screens.EmployeeAssistantStep1Screen
>;

export default function EmployeeAssistantStep1({ navigation }: Props) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
      }}
    >
      <Label>Employees Assistant</Label>
      <Hint>Step 1 of 3</Hint>
      <Hint style={{ marginTop: 12, textAlign: "center" }}>
        Dummy wizard UI: alta de empleado y configuración inicial.
      </Hint>

      <PrimaryButton
        onPress={() =>
          navigation.navigate(Screens.EmployeeAssistantStep2Screen)
        }
      >
        Siguiente
      </PrimaryButton>
      <SecondaryButton
        onPress={() => navigation.navigate(Screens.LandingScreen)}
      >
        Salir
      </SecondaryButton>
    </View>
  );
}
