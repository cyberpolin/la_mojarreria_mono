import React from "react";
import { View } from "react-native";
import { Clock, Hint, Label } from "@/components/Typography";
import { PrimaryButton } from "@/components/ui/Buttons";

type Props = {
  error: Error;
  onRetry: () => void;
};

export default function GeneralErrorScreen({ error, onRetry }: Props) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <Label>La Mojarreria!</Label>
      <Clock>ERROR</Clock>
      <View style={{ marginTop: 20, marginBottom: 20, alignItems: "center" }}>
        <Hint>Ocurrio un error inesperado.</Hint>
        <Hint>Intenta nuevamente en unos segundos.</Hint>
        {error?.message ? <Hint>{error.message}</Hint> : null}
      </View>
      <PrimaryButton onPress={onRetry}>Reintentar</PrimaryButton>
    </View>
  );
}
