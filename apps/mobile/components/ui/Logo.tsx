import { MaterialIcons } from "@expo/vector-icons";
import styled from "styled-components/native";
import { Theme } from "@/constants/Colors";

const { Primary } = Theme;

export default function Logo() {
  return (
    <LogoContainer>
      <MaterialIcons name="room-service" size={65} color={Primary} />
      <LogoText>Taku</LogoText>
    </LogoContainer>
  );
}

const LogoText = styled.Text`
  font-size: 50px;
  color: ${Primary};
  margin-left: 8px;
  font-weight: bold;
`;

const LogoContainer = styled.View`
  flex-direction: row;
`;
