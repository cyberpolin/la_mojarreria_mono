import React from "react";
import { View } from "react-native";
import { IconWarning } from "./Icons";
import styled from "styled-components/native";
import { Footer } from "@/app/DailyCloseFeature/WrapperComponents";
import BTN from "./ui/BTN";
import { OptionalButton } from "./ui/Buttons";

export const Issues = ({ issuesData }: { issuesData: string[] }) => {
  return (
    <>
      {issuesData.map((issue) => {
        return (
          <View
            key={issue.trim()}
            style={{
              display: "flex",
              flex: 0,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View
              style={{
                flex: 0,
                marginRight: 10,
              }}
            >
              <IconWarning size={15} />
            </View>
            <View
              style={{
                flex: 1,
              }}
            >
              <Label>T{issue}</Label>
            </View>
          </View>
        );
      })}
    </>
  );
};

const Label = styled.Text`
  color: #2d2d2dff;
  font-weight: 400;
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 16px;
`;
