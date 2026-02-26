import React from "react";
import { Pressable } from "react-native";
import styled from "styled-components/native";
import { Theme } from "@/constants/Colors";
import { PrimaryButton } from "./Buttons";
const { Black, Gray } = Theme;

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

export default function NumericKeypad({
  activeId,
  onKeyPress,
  canSubmit,
  onSubmit,
  submitLabel = "Enviar Reporte!",
}: {
  activeId: string | null;
  onKeyPress: (key: KeypadKey) => void;
  canSubmit: boolean;
  onSubmit: () => void;
  submitLabel?: string;
}) {
  const disabled = !activeId;

  const keys: KeypadKey[] = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "0",
    "Del",
  ];

  return (
    <>
      <Keypad style={{ opacity: disabled ? 0.4 : 1 }}>
        {keys.map((val, index) => (
          <Key
            key={`${val}-${index}`}
            index={index}
            disabled={disabled}
            onPress={() => onKeyPress(val)}
          >
            <KeyText>{val}</KeyText>
          </Key>
        ))}
      </Keypad>
      {canSubmit && (
        <PrimaryButton onPress={onSubmit}>{submitLabel}</PrimaryButton>
      )}
    </>
  );
}

const Keypad = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  width: 280px;
`;

const Key = styled(Pressable)<{ index: number; disabled?: boolean }>`
  width: ${({ index }) => (index === 10 ? "120px" : "80px")};
  height: 80px;
  margin: 5px;
  background-color: #f3f3f3;
  border-radius: 10px;
  justify-content: center;
  align-items: center;
  border-width: 1px;
  border-color: ${Gray};
`;

const KeyText = styled.Text`
  font-size: 22px;
  color: ${Black};
  font-weight: bold;
`;
