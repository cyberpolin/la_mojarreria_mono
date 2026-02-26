import { Theme } from "@/constants/Colors";
import React, { useMemo, useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
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

type ActiveId = "delivery" | "other" | null;
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
  if (!text) return 0;
  const n = Number.parseInt(text, 10);
  return Number.isFinite(n) && n >= 0 ? n * 100 : 0;
};

export default function OutcomeScreen({ navigation }: NavigationProps) {
  const setTemporalDeliveryCashPaid = useDailyCloseStore(
    (s) => s.setTemporalDeliveryCashPaid,
  );
  const setTemporalOtherCashExpenses = useDailyCloseStore(
    (s) => s.setTemporalOtherCashExpenses,
  );
  const setTemporalNotes = useDailyCloseStore((s) => s.setTemporalNotes);
  const [notesActive, setNotesActive] = useState(false);

  // keypad state
  const [activeId, setActiveId] = useState<ActiveId>(null);

  // keep strings for numeric inputs
  const [deliveryText, setDeliveryText] = useState("");
  const [otherText, setOtherText] = useState("");

  // notes uses native keyboard
  const [notes, setNotes] = useState("");

  const deliveryCashPaid = useMemo(() => toCents(deliveryText), [deliveryText]);
  const otherCashExpenses = useMemo(() => toCents(otherText), [otherText]);

  const amount = deliveryCashPaid + otherCashExpenses;

  const isValid = deliveryText !== "" && otherText !== ""; // decide if empty is allowed

  const submitReport = () => {
    setTemporalDeliveryCashPaid(deliveryCashPaid);
    setTemporalOtherCashExpenses(otherCashExpenses);
    setTemporalNotes(notes);
    navigation.navigate(Screens.IncomeOutputResumeScreen);
  };

  const onKeypadPress = (key: KeypadKey) => {
    if (!activeId) return;

    const get = activeId === "delivery" ? deliveryText : otherText;
    const set = activeId === "delivery" ? setDeliveryText : setOtherText;

    let next = get;

    if (key === "Del") next = get.slice(0, -1);
    else if (key === "Clear") next = "";
    else next = get === "0" ? key : get + key;

    // optional max length
    if (next.length > 7) return;

    set(next);
  };

  return (
    <Pressable
      style={{
        flex: 1,
        flexDirection: "row",
        margin: 50,
        justifyContent: "space-between",
        marginTop: notesActive ? -50 : 50,
      }}
      onPress={() => {
        if (notesActive) {
          Keyboard.dismiss();
          setNotesActive(false);
        }
      }}
    >
      {/* Left column */}
      <View style={{ flex: 0 }}>
        <Header title={"Corte de caja!"} subtitle={"Egresos"} />
        <View>
          {!notesActive && (
            <>
              <Label>{"¿Cuánto se pagó a repartidores (efectivo)?"}</Label>
              <StyledInput
                value={deliveryText}
                keyboardType="numeric"
                showSoftInputOnFocus={false}
                onFocus={() => {
                  Keyboard.dismiss();
                  setActiveId("delivery");
                }}
                onChangeText={(t) => setDeliveryText(t.replace(/[^\d]/g, ""))}
                placeholder="Ej. 250"
              />

              <Label>{"¿Otros gastos en efectivo?"}</Label>
              <StyledInput
                value={otherText}
                keyboardType="numeric"
                showSoftInputOnFocus={false}
                onFocus={() => {
                  Keyboard.dismiss();
                  setActiveId("other");
                }}
                onChangeText={(t) => setOtherText(t.replace(/[^\d]/g, ""))}
                placeholder="Ej. 80"
              />
            </>
          )}
          {/* TODO: make this with a complete solution using KeyboardAvoidingView */}
          <Label>{"¿Algún comentario o nota?"}</Label>
          <NotesInput
            value={notes}
            onFocus={() => {
              setActiveId(null);
              setNotesActive(true);
            }} // disable keypad while typing notes
            onChangeText={setNotes}
            placeholder="Ej. Se pagó gas / faltó cambio / etc."
            multiline
            numberOfLines={4}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            opacity: amount > 0 ? 1 : 0.2,
          }}
        >
          <Subtitle>{"Total de egresos: "}</Subtitle>
          <Subtitle>
            {Dinero({ amount, currency: "MXN" }).toFormat("$0,0.00")}
          </Subtitle>
        </View>
      </View>

      {/* Right column: keypad */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          marginTop: notesActive ? -150 : 30,
        }}
      >
        <NumericKeypad
          activeId={activeId}
          onKeyPress={onKeypadPress}
          canSubmit={isValid}
          onSubmit={submitReport}
        />
      </View>
    </Pressable>
  );
}

const Subtitle = styled.Text`
  font-size: 27px;
`;

const Label = styled.Text`
  color: #aaaaaa;
  margin-top: 0px;
  margin-bottom: 10px;
`;

const StyledInput = styled.TextInput`
  border-width: 1px;
  border-color: ${Black};
  padding: 8px 16px;
  border-radius: 8px;
  margin-bottom: 10px;
  font-size: 22px;
`;

const NotesInput = styled.TextInput`
  border-width: 1px;
  border-color: ${Black};
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 30px;
  font-size: 18px;
  min-height: 90px;
`;
