import React from "react";
import { Alert, View } from "react-native";
import styled from "styled-components/native";
import dayjs from "dayjs";
import { Footer, Header } from "./WrapperComponents";
import { useDailyCloseStore } from "./useDailyCloseStore";
import { Resume } from "@/components/Resume";
import {
  OptionalButton,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/Buttons";
import Dinero from "dinero.js";
import { DailyClose, Screens } from "./Types";

type NavigateProps = (screen: string, params?: { sales: SalesProps }) => void;

type NavigationProps = {
  navigation: {
    navigate: NavigateProps;
  };
};

type SalesProps = Record<string, string>;

const ISSUES = ["You need this", "You need that", "etc..."];

// TODO: make this kid of a wizzard, ask the amount per item and just wait for the number until no more itmes to save
export default ({ navigation }: NavigationProps) => {
  const temporalSale = useDailyCloseStore((state) => state.temporalSale);
  const upsertClose = useDailyCloseStore((state) => state.upsertClose);
  const closeOperator = useDailyCloseStore((state) => state.closeOperator);
  const resetTemporalSales = useDailyCloseStore(
    (state) => state.resetTemporalSales,
  );
  const submitReport = () => {
    if (!temporalSale.closedByUserId && !closeOperator?.userId) {
      Alert.alert(
        "Falta autorización",
        "Debes validar teléfono y PIN para registrar un cierre.",
      );
      navigation.navigate(Screens.LandingScreen);
      return;
    }

    const close = { ...temporalSale };
    // remove stepPosition from close
    delete close.stepPosition;
    // set createdAt
    close.createdAt = dayjs().toISOString();
    // set date to YYYY-MM-DD
    close.date = dayjs(close.date).format("YYYY-MM-DD");
    // set expectedTotal
    close.expectedTotal = close.items?.reduce(
      (acc, item) => acc + item.qty * item.price,
      0,
    );
    // set default values for numbers
    close.cashReceived = close.cashReceived || 0;
    close.bankTransfersReceived = close.bankTransfersReceived || 0;
    close.deliveryCashPaid = close.deliveryCashPaid || 0;
    close.otherCashExpenses = close.otherCashExpenses || 0;
    close.closedByUserId = close.closedByUserId || closeOperator?.userId || "";
    close.closedByName = close.closedByName || closeOperator?.name || "";
    close.closedByPhone = close.closedByPhone || closeOperator?.phone || "";
    // upsert close
    upsertClose(close as DailyClose);
    navigation.navigate(Screens.LandingScreen);
  };

  const {
    date,
    items,
    deliveryCashPaid,
    otherCashExpenses,
    cashReceived,
    bankTransfersReceived,
  } = temporalSale;

  return (
    <View style={{ flex: 1, marginVertical: 25, marginHorizontal: 50 }}>
      <Header
        title={"Confirmacion!"}
        subtitle={dayjs(date).format("dddd, D [de] MMMM")}
      />
      <View
        style={{
          display: "flex",
          flex: 0,
        }}
      >
        <View style={{ display: "flex", flex: 0, flexDirection: "row" }}>
          <Resume
            key={"r1"}
            data={{
              key: "Ingresos",
              value: cashReceived! + bankTransfersReceived!,
            }}
          />
          <Resume
            key={"r2"}
            data={{
              key: "Egresos",
              value: deliveryCashPaid! + otherCashExpenses!,
            }}
          />
          <Resume
            key={"r3"}
            data={{
              key: "Total",
              value:
                cashReceived! +
                bankTransfersReceived! -
                (deliveryCashPaid! + otherCashExpenses!),
            }}
          />
        </View>
        {/* INGRESOS */}
        <Label style={{ fontWeight: "medium", fontSize: 16 }}>
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
            paddingHorizontal: 0,
            marginHorizontal: 0,
          }}
        >
          <View style={{ flex: 0.2, marginRight: 10, alignItems: "flex-end" }}>
            <Label style={{ flex: 0 }}>Cantidad</Label>
          </View>
          <View style={{ flex: 1 }}>
            <Label style={{ flex: 3 }}>Producto</Label>
          </View>
          <View style={{ flex: 0.5, alignItems: "flex-end" }}>
            <Label style={{ flex: 1 }}>Precio</Label>
          </View>
          <View style={{ flex: 0.5, alignItems: "flex-end" }}>
            <Label style={{ flex: 1 }}>Total</Label>
          </View>
        </View>

        {items?.map(({ name, qty, price, productId }) => (
          <View
            key={productId}
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
              style={{ flex: 0.2, marginRight: 10, alignItems: "flex-end" }}
            >
              <Label style={{ flex: 0 }}>{qty}</Label>
            </View>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Label style={{ flex: 3 }}>{name}</Label>
            </View>
            <View
              style={{ flex: 0.5, marginRight: 10, alignItems: "flex-end" }}
            >
              <Label style={{ flex: 0 }}>
                {Dinero({ amount: price, currency: "MXN" }).toFormat("$0,0.00")}
              </Label>
            </View>
            <View
              style={{ flex: 0.5, marginRight: 10, alignItems: "flex-end" }}
            >
              <Label style={{ flex: 1 }}>
                {Dinero({ amount: qty * price, currency: "MXN" }).toFormat(
                  "$0,0.00",
                )}
              </Label>
            </View>
          </View>
        ))}
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
              Total ingresos:{" "}
              {Dinero({
                amount: items?.reduce(
                  (acc, item) => acc + item.qty * item.price,
                  0,
                ),
                currency: "MXN",
              }).toFormat("$0,0.00")}
            </Label>
          </View>
        </View>

        {/* INGRESOS */}
        {/* INGRESOS */}
      </View>
      {/* EGRESOS */}

      {/* // issue */}
      {/* <Issues issuesData={ISSUES} /> */}

      <Footer>
        <SecondaryButton
          onPress={() => {
            Alert.alert(
              "Esto borrar todos tus avances",
              "¿Quieres volver a ventas diarias?",
              [
                { text: "No", style: "cancel" },
                {
                  text: "OK",
                  onPress: () => {
                    resetTemporalSales();
                    navigation.navigate(Screens.LandingScreen);
                  },
                },
              ],
              { cancelable: true },
            );
          }}
        >
          Cancelar
        </SecondaryButton>
        {/* <OptionalButton
          onPress={function (): void {
            throw new Error("Function not implemented.");
          }}
        >
          Editar
        </OptionalButton> */}
        <PrimaryButton onPress={submitReport}>
          Confirmar y Guardar
        </PrimaryButton>
      </Footer>
    </View>
  );
};

const Label = styled.Text`
  color: #2d2d2dff;
  font-weight: 400;
  margin-top: 8px;
  margin-bottom: 8px;
  font-size: 16px;
`;
