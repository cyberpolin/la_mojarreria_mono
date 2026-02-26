import React from "react";
import { View } from "react-native";
import { Label, Hint } from "@/components/Typography";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "./NavigationStack";
import { Screens } from "./Types";

type Props = NativeStackScreenProps<
  RootStackParamList,
  Screens.EmployeeAssistantStep3Screen
>;

export default function EmployeeAssistantStep3({ navigation }: Props) {
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
      <Hint>Step 3 of 3</Hint>
      <Hint style={{ marginTop: 12, textAlign: "center" }}>
        Dummy wizard UI: resumen final y confirmación.
      </Hint>

      <PrimaryButton onPress={() => navigation.navigate(Screens.LandingScreen)}>
        Finalizar
      </PrimaryButton>
      <SecondaryButton
        onPress={() =>
          navigation.navigate(Screens.EmployeeAssistantStep2Screen)
        }
      >
        Anterior
      </SecondaryButton>
    </View>
  );
}
