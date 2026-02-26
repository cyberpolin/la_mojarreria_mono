import React from "react";
import { View } from "react-native";
import { Label, Hint } from "@/components/Typography";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "./NavigationStack";
import { Screens } from "./Types";

type Props = NativeStackScreenProps<
  RootStackParamList,
  Screens.EmployeeAssistantStep2Screen
>;

export default function EmployeeAssistantStep2({ navigation }: Props) {
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
      <Hint>Step 2 of 3</Hint>
      <Hint style={{ marginTop: 12, textAlign: "center" }}>
        Dummy wizard UI: accesos (PIN/password) y permisos.
      </Hint>

      <PrimaryButton
        onPress={() =>
          navigation.navigate(Screens.EmployeeAssistantStep3Screen)
        }
      >
        Siguiente
      </PrimaryButton>
      <SecondaryButton
        onPress={() =>
          navigation.navigate(Screens.EmployeeAssistantStep1Screen)
        }
      >
        Anterior
      </SecondaryButton>
    </View>
  );
}
