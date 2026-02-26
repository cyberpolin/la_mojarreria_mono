import Dinero from "dinero.js";
import { View } from "react-native";
import styled from "styled-components/native";
import { H1, Hint, Subtitle } from "./Typography";

export const Resume = ({
  data: { key, value },
}: {
  data: { key: string; value: number };
}) => {
  return (
    <Wrapper>
      <Hint>{key}:</Hint>
      <H1 style={{ alignSelf: "flex-end" }}>
        {Dinero({ amount: value, currency: "MXN" }).toFormat("$0,0.00")}
      </H1>
    </Wrapper>
  );
};

//TODO figure out how to remove margins for first and last child
const Wrapper = styled.View`
  flex: 1;
  padding: 10px 20px;
  background-color: #00000010;
  border: 1px solid #00000030;
  border-radius: 4px;
  margin: 0px 10px;
`;
