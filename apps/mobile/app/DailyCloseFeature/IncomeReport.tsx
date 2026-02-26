import { Theme } from "@/constants/Colors";
import React, { useMemo, useState } from "react";
import { Keyboard, View } from "react-native";
import styled from "styled-components/native";
import { Header } from "./WrapperComponents";
import { useDailyCloseStore } from "./useDailyCloseStore";
import NumericKeypad from "@/components/ui/NumericKeyPad";
import { Screens } from "./Types";

import Dinero from "dinero.js";

const { Black } = Theme;

type NavigateProps = (screen: string) => void;

type NavigationProps = {
  navigation: { navigate: NavigateProps };
};

type ActiveId = "cash" | "bank" | null;
type KeypadKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "Del"
  | "Clear";

const toCents = (text: string) => {
  // text is pesos as integer string (e.g. "150" -> 15000 cents)
  if (!text) return 0;
  const n = Number.parseInt(text, 10);
  return Number.isFinite(n) && n >= 0 ? n * 100 : 0;
};

export default function IncomeScreen({ navigation }: NavigationProps) {
  const [activeId, setActiveId] = useState<ActiveId>(null);

  // keep raw text values for keypad composition
  const [cashText, setCashText] = useState("");
  const [bankText, setBankText] = useState("");

  const setTemporalCashReceived = useDailyCloseStore(
    (s) => s.setTemporalCashReceived,
  );
  const setTemporalBankReceived = useDailyCloseStore(
    (s) => s.setTemporalBankReceived,
  );

  const cashReceived = useMemo(() => toCents(cashText), [cashText]);
  const bankTransfersReceived = useMemo(() => toCents(bankText), [bankText]);

  const amount = cashReceived + bankTransfersReceived;

  const isValid = cashText !== "" && bankText !== ""; // or >=0 rules; choose your UX

  const submitReport = () => {
    setTemporalCashReceived(cashReceived);
    setTemporalBankReceived(bankTransfersReceived);
    navigation.navigate(Screens.OutcomeReportScreen);
  };

  const onKeypadPress = (key: KeypadKey) => {
    if (!activeId) return;

    const get = activeId === "cash" ? cashText : bankText;
    const set = activeId === "cash" ? setCashText : setBankText;

    let next = get;

    if (key === "Del") next = get.slice(0, -1);
    else if (key === "Clear") next = "";
    else next = get === "0" ? key : get + key;

    // optional: prevent crazy big numbers
    if (next.length > 7) return;

    set(next);
  };

  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        margin: 50,
        justifyContent: "space-between",
        marginVertical: 25,
        marginHorizontal: 50,
      }}
    >
      {/* <View style={{ flex: 1, justifyContent: "flex-start",  }}></View> */}
      <View style={{ flex: 1 }}>
        <Header title={"Corte de caja!"} subtitle={"Ingresos"} />

        <View style={{ flex: 0 }}>
          <Label>{"Cuánto hay en caja?"}</Label>
          <StyledInput
            showSoftInputOnFocus={false}
            keyboardType="numeric"
            value={cashText}
            onFocus={() => {
              Keyboard.dismiss();
              setActiveId("cash");
            }}
            onChangeText={(t) => setCashText(t.replace(/[^\d]/g, ""))}
            placeholder="Ingrese cantidad"
          />

          <Label>{"Cuánto hay en depósitos?"}</Label>
          <StyledInput
            showSoftInputOnFocus={false}
            keyboardType="numeric"
            value={bankText}
            onFocus={() => {
              Keyboard.dismiss();
              setActiveId("bank");
            }}
            onChangeText={(t) => setBankText(t.replace(/[^\d]/g, ""))}
            placeholder="Ingrese cantidad"
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            opacity: amount > 0 ? 1 : 0.2,
          }}
        >
          <Subtitle>{"Total de ingresos: "}</Subtitle>
          <Subtitle>
            {Dinero({ amount, currency: "MXN" }).toFormat("$0,0.00")}
          </Subtitle>
        </View>
      </View>

      <View style={{ flex: 1, alignItems: "center", marginTop: 30 }}>
        <NumericKeypad
          activeId={activeId}
          onKeyPress={onKeypadPress}
          canSubmit={isValid}
          onSubmit={submitReport}
        />
      </View>
    </View>
  );
}

const Subtitle = styled.Text`
  font-size: 27px;
`;

const Label = styled.Text`
  color: #aaaaaa;
  margin-top: 10px;
  margin-bottom: 10px;
`;

const StyledInput = styled.TextInput`
  border-width: 1px;
  border-color: ${Black};
  padding: 8px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 22px;
`;
