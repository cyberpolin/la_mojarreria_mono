import { Theme } from "@/constants/Colors";
import React, { useState } from "react";
import { View } from "react-native";
import styled from "styled-components/native";
import BTN from "@/components/ui/BTN";
import { RootStackParamList } from "./NavigationStack";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Footer, Header } from "./WrapperComponents";
import { useDailyCloseStore } from "./useDailyCloseStore";
import { Button } from "react-native-paper";
import { Screens } from "./Types";
import dayjs from "dayjs";
import Dinero from "dinero.js";

const { Black } = Theme;

type Props = NativeStackScreenProps<
  RootStackParamList,
  Screens.DailySalesConfirmScreen
>;

// TODO: make this kid of a wizzard, ask the amount per item and just wait for the number until no more itmes to save
export default ({ navigation }: Props) => {
  const submitReport = () => {
    navigation.navigate(Screens.IncomeReportScreen);
  };

  const temporalSaleItems =
    useDailyCloseStore((state) => state.temporalSale.items) || [];
  const date = useDailyCloseStore((state) => state.temporalSale.date);
  const resetTemporalSales = useDailyCloseStore(
    (state) => state.resetTemporalSales,
  );

  let total = 0;

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "flex-start",
        marginVertical: 25,
        marginHorizontal: 50,
      }}
    >
      <Header
        title={"Total de ingresos por productos"}
        subtitle={dayjs(date).format("dddd, D [de] MMMM")}
      />
      <View
        style={{
          display: "flex",
          flex: 0,
          marginTop: 50,
          marginBottom: 50,
        }}
      >
        {temporalSaleItems.map((item) => {
          const totalAmount = item.qty * item.price;
          const price = Dinero({ amount: totalAmount, currency: "MXN" });
          total += totalAmount;
          return (
            <View
              key={item.productId}
              style={{
                display: "flex",
                flexDirection: "row",
              }}
            >
              <View
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "row",
                  gap: 10,
                }}
              >
                <Label>{item.qty}</Label>
                <Label>{item.name}</Label>
              </View>
              <View style={{ flex: 1, display: "flex", flexDirection: "row" }}>
                <SubTotal>{price.toFormat("$0,0.00")}</SubTotal>
              </View>
            </View>
          );
        })}
      </View>
      <View
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "flex-end",
        }}
      >
        <Subtitle>{"total: "}</Subtitle>
        <Subtitle>
          {Dinero({ amount: total, currency: "MXN" }).toFormat("$0,0.00")}
        </Subtitle>
      </View>
      <Footer>
        <View
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button
            onPress={() => {
              resetTemporalSales();
              navigation.goBack();
            }}
          >
            <Label
              style={{
                color: "#00000070",
                borderBottomWidth: 1,
                borderBottomColor: "#00000070",
                height: 280,
              }}
            >
              Cancelar
            </Label>
          </Button>
        </View>
        <View
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <BTN text={"Confirmar!"} onPress={submitReport} />
        </View>
      </Footer>
    </View>
  );
};

const Subtitle = styled.Text`
  font-size: 27px;
`;
const Label = styled.Text`
  color: #aaaaaa;
  margin-top: 10px;
  margin-bottom: 10px;
`;

const SubTotal = styled.Text`
  color: #2d2d2dff;
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 20px;
`;
