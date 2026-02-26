import styled from "styled-components/native";
import { Checkbox } from "react-native-paper";
import { Theme } from "@/constants/Colors";

const { Primary } = Theme;
export default function Check({
  status,
  onPress,
}: {
  status: "checked" | "unchecked";
  onPress: () => void;
}) {
  return (
    <BigCheckboxContainer>
      <Checkbox color={Primary} status={status} onPress={() => onPress()} />
    </BigCheckboxContainer>
  );
}

const BigCheckboxContainer = styled.View`
  transform: scale(2);
`;
