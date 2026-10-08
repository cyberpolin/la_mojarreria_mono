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

const PORTRAIT_ROWS: KeypadKey[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

export default function NumericKeypad({
  activeId,
  onKeyPress,
  canSubmit,
  onSubmit,
  submitLabel = "Enviar Reporte!",
  compact = false,
  portrait = false,
}: {
  activeId: string | null;
  onKeyPress: (key: KeypadKey) => void;
  canSubmit: boolean;
  onSubmit: () => void;
  submitLabel?: string;
  compact?: boolean;
  portrait?: boolean;
}) {
  const disabled = !activeId;

  if (portrait) {
    return (
      <>
        <PortraitKeypad style={{ opacity: disabled ? 0.4 : 1 }}>
          {PORTRAIT_ROWS.map((row) => (
            <PortraitRow key={row.join("-")}>
              {row.map((val) => (
                <PortraitKey
                  key={val}
                  disabled={disabled}
                  onPress={() => onKeyPress(val)}
                >
                  <PortraitKeyText>{val}</PortraitKeyText>
                </PortraitKey>
              ))}
            </PortraitRow>
          ))}
          <PortraitRow>
            <PortraitKey
              $flex={2}
              disabled={disabled}
              onPress={() => onKeyPress("0")}
            >
              <PortraitKeyText>0</PortraitKeyText>
            </PortraitKey>
            <PortraitKey disabled={disabled} onPress={() => onKeyPress("Del")}>
              <PortraitKeyText>Del</PortraitKeyText>
            </PortraitKey>
          </PortraitRow>
        </PortraitKeypad>
        {canSubmit ? (
          <PrimaryButton onPress={onSubmit}>{submitLabel}</PrimaryButton>
        ) : null}
      </>
    );
  }

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

const PortraitKeypad = styled.View`
  width: 100%;
`;

const PortraitRow = styled.View`
  flex-direction: row;
  width: 100%;
`;

const PortraitKey = styled(Pressable)<{ $flex?: number }>`
  flex: ${({ $flex }) => $flex ?? 1};
  height: 64px;
  margin: 4px;
  background-color: #f3f3f3;
  border-radius: 10px;
  justify-content: center;
  align-items: center;
  border-width: 1px;
  border-color: ${Gray};
`;

const PortraitKeyText = styled.Text`
  font-size: 24px;
  color: ${Black};
  font-weight: bold;
`;
