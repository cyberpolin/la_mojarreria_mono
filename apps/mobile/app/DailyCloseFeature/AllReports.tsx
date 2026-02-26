import React, { useCallback, useState } from "react";
import {
  ScrollView,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import styled from "styled-components/native";
import dayjs from "dayjs";
import { Footer, Header } from "./WrapperComponents";
import { useDailyCloseStore } from "./useDailyCloseStore";
import { PrimaryButton } from "@/components/ui/Buttons";
import Dinero from "dinero.js";

type SalesProps = Record<string, string>;

const ISSUES = ["You need this", "You need that", "etc..."];

// TODO: make this kid of a wizzard, ask the amount per item and just wait for the number until no more itmes to save
export default ({ navigation }: { navigation: { goBack: () => void } }) => {
  const availebleCloses = useDailyCloseStore((state) => state.closesByDate);
  const lastSevenCloses = Object.values(availebleCloses)
    .sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix())
    .slice(0, 7);
  const [isCompactHeader, setIsCompactHeader] = useState(false);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      setIsCompactHeader(y >= 30);
    },
    [],
  );

  return (
    <View style={{ flex: 1, margin: 50, marginTop: 0 }}>
      <Header title={"Historial de cierres!"} subtitle={""} compact />
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View
          style={{
            display: "flex",
            flex: 1,
          }}
        >
          {/* INGRESOS */}
          <Label style={{ fontWeight: "medium", fontSize: 18 }}>
            Ingresos por productos
          </Label>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#00000010",
              paddingLeft: 10,
              paddingRight: 10,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
            }}
          >
            <View
              style={{ flex: 0.3, marginRight: 10, alignItems: "flex-end" }}
            >
              <Label style={{ flex: 0 }}>Fecha</Label>
            </View>
            <View style={{ flex: 1 }}>
              <Label style={{ flex: 3 }}>Ingresos</Label>
            </View>
            <View style={{ flex: 0.5, alignItems: "flex-end" }}>
              <Label style={{ flex: 1 }}>Egresos</Label>
            </View>
            <View style={{ flex: 0.5, alignItems: "flex-end" }}>
              <Label style={{ flex: 1 }}>Total</Label>
            </View>
          </View>

          {lastSevenCloses?.map(
            ({
              date,
              cashReceived,
              bankTransfersReceived,
              deliveryCashPaid,
              otherCashExpenses,
            }) => (
              <View
                key={date}
                style={{
                  flexDirection: "row",
                  backgroundColor: "#00000002",
                  paddingLeft: 10,
                  paddingRight: 10,
                  marginTop: 0,
                  marginBottom: 0,
                }}
              >
                <View
                  style={{ flex: 0.3, marginRight: 10, alignItems: "flex-end" }}
                >
                  <Label style={{ flex: 0 }}>{date}</Label>
                </View>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Label style={{ flex: 3 }}>
                    {Dinero({
                      amount: cashReceived + bankTransfersReceived,
                      currency: "MXN",
                    }).toFormat("$0,0.00")}
                  </Label>
                </View>
                <View
                  style={{ flex: 0.5, marginRight: 10, alignItems: "flex-end" }}
                >
                  <Label style={{ flex: 0 }}>
                    {Dinero({
                      amount: deliveryCashPaid + otherCashExpenses,
                      currency: "MXN",
                    }).toFormat("$0,0.00")}
                  </Label>
                </View>
                <View
                  style={{ flex: 0.5, marginRight: 10, alignItems: "flex-end" }}
                >
                  <Label style={{ flex: 1 }}>
                    {Dinero({
                      amount:
                        cashReceived +
                        bankTransfersReceived -
                        (deliveryCashPaid + otherCashExpenses),
                      currency: "MXN",
                    }).toFormat("$0,0.00")}
                  </Label>
                </View>
              </View>
            ),
          )}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#00000005",
              paddingLeft: 10,
              paddingRight: 10,
              borderBottomLeftRadius: 4,
              borderBottomRightRadius: 4,
            }}
          >
            <View style={{ flex: 1, marginRight: 10, alignItems: "flex-end" }}>
              <Label style={{ flex: 0, fontWeight: "bold" }}>
                Total ingresos semanal:{" "}
                {Dinero({
                  amount: lastSevenCloses?.reduce(
                    (acc, close) =>
                      acc + (close.cashReceived + close.bankTransfersReceived),
                    0,
                  ),
                  currency: "MXN",
                }).toFormat("$0,0.00")}
              </Label>
            </View>
          </View>
        </View>
      </ScrollView>
      {/* EGRESOS */}

      {/* // issue */}
      {/* <Issues issuesData={ISSUES} /> */}

      <Footer>
        <PrimaryButton onPress={() => navigation.goBack()}>Ok</PrimaryButton>
      </Footer>
    </View>
  );
};

const Label = styled.Text`
  color: #2d2d2dff;
  font-weight: 400;
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 16px;
`;
