import React from "react";
import styled from "styled-components/native";
import { Label } from "../Typography";

const SecondaryButton = ({
  children,
  onPress,
  disabled = false,
  style,
  textStyle,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
  textStyle?: object;
}) => (
  <SecondaryButtonComponent
    onPress={onPress}
    disabled={disabled}
    style={disabled ? { opacity: 0.5, ...style } : { ...style }}
  >
    <Label style={{ color: "#666", ...textStyle }}>{children}</Label>
  </SecondaryButtonComponent>
);

const OptionalButton = ({
  children,
  onPress,
  icon,
}: {
  children: React.ReactNode;
  onPress: () => void;
  icon?: React.ReactNode;
}) => (
  <OptionalButtonComponent onPress={onPress}>
    {icon && icon}
    <Label>{children}</Label>
  </OptionalButtonComponent>
);
const PrimaryButton = ({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress: () => void;
}) => (
  <PrimaryButtonComponent onPress={onPress}>
    <Label style={{ color: "white" }}>{children}</Label>
  </PrimaryButtonComponent>
);

const SecondaryButtonComponent = styled.TouchableOpacity`
  background-color: transparent;
  height: 45px;
  align-items: center;
  justify-content: center;
  border-bottom-color: #666;
  border-bottom-width: 1px;
  border-radius: 0px;
  margin: 10px 20px;
`;

const OptionalButtonComponent = styled.TouchableOpacity`
  background-color: transparent;
  padding: 10px 20px;
  border-radius: 4px;
  border: 1px solid #ccc;
  height: 45px;
  margin: 10px 20px;
`;

const PrimaryButtonComponent = styled.TouchableOpacity`
  background-color: #000;
  padding: 10px 20px;
  border-radius: 4px;
  height: 45px;
  align-items: center;
  justify-content: center;
  margin: 10px 20px;
`;

export { PrimaryButton, SecondaryButton, OptionalButton };
