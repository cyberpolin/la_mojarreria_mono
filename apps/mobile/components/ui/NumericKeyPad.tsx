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
  compact = false,
}: {
  activeId: string | null;
  onKeyPress: (key: KeypadKey) => void;
  canSubmit: boolean;
  onSubmit: () => void;
  submitLabel?: string;
  compact?: boolean;
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
      <Keypad compact={compact} style={{ opacity: disabled ? 0.4 : 1 }}>
        {keys.map((val, index) => (
          <Key
            key={`${val}-${index}`}
            index={index}
            compact={compact}
            disabled={disabled}
            onPress={() => onKeyPress(val)}
          >
            <KeyText compact={compact}>{val}</KeyText>
          </Key>
        ))}
      </Keypad>
      {canSubmit && (
        <PrimaryButton onPress={onSubmit}>{submitLabel}</PrimaryButton>
      )}
    </>
  );
}

const Keypad = styled.View<{ compact?: boolean }>`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  width: ${({ compact }) => (compact ? "232px" : "280px")};
`;

const Key = styled(Pressable)<{
  index: number;
  disabled?: boolean;
  compact?: boolean;
}>`
  width: ${({ index, compact }) => {
    if (compact) return index === 10 ? "96px" : "64px";
    return index === 10 ? "120px" : "80px";
  }};
  height: ${({ compact }) => (compact ? "52px" : "80px")};
  margin: ${({ compact }) => (compact ? "4px" : "5px")};
  background-color: #f3f3f3;
  border-radius: 10px;
  justify-content: center;
  align-items: center;
  border-width: 1px;
  border-color: ${Gray};
`;

const KeyText = styled.Text<{ compact?: boolean }>`
  font-size: ${({ compact }) => (compact ? "18px" : "22px")};
  color: ${Black};
  font-weight: bold;
`;
