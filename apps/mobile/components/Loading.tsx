import React from "react";
import { ActivityIndicator, View } from "react-native";
import styled from "styled-components/native";

export default function Loading() {
  return (
    <Wrapper>
      <ActivityIndicator size="large" />
    </Wrapper>
  );
}

const Wrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;
