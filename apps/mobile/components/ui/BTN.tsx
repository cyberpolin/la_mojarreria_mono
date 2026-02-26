import styled from "styled-components/native";
import { ActivityIndicator } from "react-native";
import { Theme } from "@/constants/Colors";

const { Black } = Theme;

export default function BTN({
  text,
  disabled,
  onPress,
  padding,
  margin,
  width,
  loading,
}: {
  text: string;
  disabled?: boolean;
  onPress: () => void;
  padding?: string;
  width?: string;
  margin?: string;
  loading?: boolean;
}) {
  return (
    <Button
      padding={padding}
      margin={margin}
      width={width}
      disabled={disabled || loading}
      onPress={() => {
        onPress();
      }}
    >
      <>
        <Label>{text}</Label>
        {loading && <ActivityIndicator size="small" color="white" />}
      </>
    </Button>
  );
}

const Button = styled.Pressable<{
  padding?: string;
  margin?: string;
  width?: string;
  loading?: boolean;
}>`
  borderwidth: 0;
  background-color: ${(props) =>
    props.disabled || props.loading ? "#444" : Black};
  padding: ${(props) => props.padding || "8px 50px"};
  border-radius: 2px;
  width: ${(props) => props.width || "280px"};
  height: 45px;
  margin: ${(props) => props.margin || "30px 0 0 0"};
  flex-direction: row;
  justify-content: center;
`;

const Label = styled.Text`
  color: white;
  font-size: 20px;
  text-align: center;
  margin-right: 10px;
`;
