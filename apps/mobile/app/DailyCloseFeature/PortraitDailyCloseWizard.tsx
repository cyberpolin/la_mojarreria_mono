import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  View,
} from "react-native";
import styled from "styled-components/native";
import dayjs from "dayjs";
import Dinero from "dinero.js";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Hint } from "@/components/Typography";
import { Theme } from "@/constants/Colors";
import NumericKeypad from "@/components/ui/NumericKeyPad";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { Resume } from "@/components/Resume";
import { RootStackParamList } from "./NavigationStack";
import { CloseEvidencePhoto, DailyClose, ProductSale, Screens } from "./Types";
import { Header } from "./WrapperComponents";
import { useDailyCloseStore } from "./useDailyCloseStore";
import PortraitCloseEvidenceStep from "./PortraitCloseEvidenceStep";
import { CLOSE_EVIDENCE_SLOTS, hasAllCloseEvidence } from "./closeEvidence";

const { Black } = Theme;

type Props = NativeStackScreenProps<
  RootStackParamList,
  Screens.PortraitDailyCloseWizardScreen
>;

type WizardStep =
  | "sales"
  | "confirm"
  | "income"
  | "outcome"
  | "evidence"
  | "resume";
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

export default function PortraitDailyCloseWizard({ navigation }: Props) {
  const [step, setStep] = useState<WizardStep>("evidence");
  const now = useMemo(() => dayjs(), []);

  const availableProducts = useDailyCloseStore(
    (state) => state.availableProducts,
  );
  const setTemporalSaleItems = useDailyCloseStore(
    (state) => state.setTemporalSaleItems,
  );
  const setTemporalCashReceived = useDailyCloseStore(
    (state) => state.setTemporalCashReceived,
  );
  const setTemporalBankReceived = useDailyCloseStore(
    (state) => state.setTemporalBankReceived,
  );
  const setTemporalDeliveryCashPaid = useDailyCloseStore(
    (state) => state.setTemporalDeliveryCashPaid,
  );
  const setTemporalOtherCashExpenses = useDailyCloseStore(
    (state) => state.setTemporalOtherCashExpenses,
  );
  const setTemporalNotes = useDailyCloseStore(
    (state) => state.setTemporalNotes,
  );
  const setTemporalEvidence = useDailyCloseStore(
    (state) => state.setTemporalEvidence,
  );
  const temporalSale = useDailyCloseStore((state) => state.temporalSale);
  const upsertClose = useDailyCloseStore((state) => state.upsertClose);
  const closeOperator = useDailyCloseStore((state) => state.closeOperator);
  const resetTemporalSales = useDailyCloseStore(
    (state) => state.resetTemporalSales,
  );

  const [localTemporalSaleItems, setLocalTemporalSaleItems] = useState<
    ProductSale[]
  >([]);
  const [activeSalesId, setActiveSalesId] = useState<string | null>(null);

  const [cashText, setCashText] = useState("");
  const [bankText, setBankText] = useState("");
  const [activeIncomeId, setActiveIncomeId] = useState<"cash" | "bank" | null>(
    null,
  );

  const [deliveryText, setDeliveryText] = useState("");
  const [otherText, setOtherText] = useState("");
  const [notes, setNotes] = useState("");
  const [notesActive, setNotesActive] = useState(false);
  const [activeOutcomeId, setActiveOutcomeId] = useState<
    "delivery" | "other" | null
  >(null);
  const [evidencePhotos, setEvidencePhotos] = useState<CloseEvidencePhoto[]>(
    [],
  );

  const goHome = () => navigation.navigate(Screens.PortraitLandingScreen);

  const getQtyString = (productId: string) => {
    const found = localTemporalSaleItems.find((x) => x.productId === productId);
    return found?.qty === undefined || Number.isNaN(found.qty)
      ? ""
      : String(found.qty);
  };

  const upsertQty = (product: Omit<ProductSale, "qty">, nextText: string) => {
    const qty = nextText.trim() === "" ? NaN : Number.parseInt(nextText, 10);

    setLocalTemporalSaleItems((prev) => {
      const idx = prev.findIndex((sp) => sp.productId === product.productId);

      if (!Number.isFinite(qty) || qty < 0) {
        if (idx === -1) return prev;
        const copy = [...prev];
        copy.splice(idx, 1);
        return copy;
      }

      const newItem: ProductSale = { ...product, qty };

      if (idx === -1) return [...prev, newItem];
      const copy = [...prev];
      copy.splice(idx, 1, newItem);
      return copy;
    });
  };

  const onSalesKeypadPress = (key: KeypadKey) => {
    if (!activeSalesId) return;

    const product = availableProducts.find(
      (p) => p.productId === activeSalesId,
    );
    if (!product) return;

    const current = getQtyString(activeSalesId);
    let next = current;

    if (key === "Del") next = current.slice(0, -1);
    else if (key === "Clear") next = "";
    else next = current === "0" ? key : current + key;

    upsertQty(product, next);
  };

  const canSubmitSales =
    localTemporalSaleItems.length === availableProducts.length;

  const submitSales = () => {
    setTemporalSaleItems(localTemporalSaleItems);
    setStep("confirm");
  };

  const applyMoneyKey = (current: string, key: KeypadKey) => {
    let next = current;
    if (key === "Del") next = current.slice(0, -1);
    else if (key === "Clear") next = "";
    else next = current === "0" ? key : current + key;
    if (next.length > 7) return current;
    return next;
  };

  const cashReceived = useMemo(() => toCents(cashText), [cashText]);
  const bankTransfersReceived = useMemo(() => toCents(bankText), [bankText]);
  const incomeTotal = cashReceived + bankTransfersReceived;
  const canSubmitIncome = cashText !== "" && bankText !== "";

  const onIncomeKeypadPress = (key: KeypadKey) => {
    if (!activeIncomeId) return;
    if (activeIncomeId === "cash") {
      setCashText((prev) => applyMoneyKey(prev, key));
      return;
    }
    setBankText((prev) => applyMoneyKey(prev, key));
  };

  const submitIncome = () => {
    setTemporalCashReceived(cashReceived);
    setTemporalBankReceived(bankTransfersReceived);
    setStep("outcome");
  };

  const deliveryCashPaid = useMemo(() => toCents(deliveryText), [deliveryText]);
  const otherCashExpenses = useMemo(() => toCents(otherText), [otherText]);
  const outcomeTotal = deliveryCashPaid + otherCashExpenses;
  const canSubmitOutcome = deliveryText !== "" && otherText !== "";

  const onOutcomeKeypadPress = (key: KeypadKey) => {
    if (!activeOutcomeId) return;
    if (activeOutcomeId === "delivery") {
      setDeliveryText((prev) => applyMoneyKey(prev, key));
      return;
    }
    setOtherText((prev) => applyMoneyKey(prev, key));
  };

  const submitOutcome = () => {
    setTemporalDeliveryCashPaid(deliveryCashPaid);
    setTemporalOtherCashExpenses(otherCashExpenses);
    setTemporalNotes(notes);
    setStep("resume");
  };

  const submitEvidence = () => {
    if (!hasAllCloseEvidence(evidencePhotos)) return;
    setTemporalEvidence(evidencePhotos);
    setStep("sales");
  };

  const submitClose = () => {
    if (!temporalSale.closedByUserId && !closeOperator?.userId) {
      Alert.alert(
        "Falta autorización",
        "Debes validar teléfono y PIN para registrar un cierre.",
      );
      goHome();
      return;
    }

    const close = { ...temporalSale };
    delete close.stepPosition;
    close.createdAt = dayjs().toISOString();
    close.date = dayjs(close.date).format("YYYY-MM-DD");
    close.expectedTotal = close.items?.reduce(
      (acc, item) => acc + item.qty * item.price,
      0,
    );
    close.cashReceived = close.cashReceived || 0;
    close.bankTransfersReceived = close.bankTransfersReceived || 0;
    close.deliveryCashPaid = close.deliveryCashPaid || 0;
    close.otherCashExpenses = close.otherCashExpenses || 0;
    close.closedByUserId = close.closedByUserId || closeOperator?.userId || "";
    close.closedByName = close.closedByName || closeOperator?.name || "";
    close.closedByPhone = close.closedByPhone || closeOperator?.phone || "";
    close.evidence = evidencePhotos;
    if (!hasAllCloseEvidence(evidencePhotos)) {
      Alert.alert(
        "Faltan evidencias",
        "Debes tomar las 4 fotos para guardar el cierre.",
      );
      setStep("evidence");
      return;
    }
    upsertClose(close as DailyClose);
    goHome();
  };

  const confirmCancel = () => {
    Alert.alert(
      "Esto borrar todos tus avances",
      "¿Quieres volver al inicio?",
      [
        { text: "No", style: "cancel" },
        {
          text: "OK",
          onPress: () => {
            resetTemporalSales();
            goHome();
          },
        },
      ],
      { cancelable: true },
    );
  };

  const salesItems = temporalSale.items || [];
  const salesConfirmTotal = salesItems.reduce(
    (acc, item) => acc + item.qty * item.price,
    0,
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {step === "sales" ? (
          <PortraitStep
            keypad={
              <NumericKeypad
                compact
                activeId={activeSalesId}
                onKeyPress={onSalesKeypadPress}
                canSubmit={canSubmitSales}
                onSubmit={submitSales}
              />
            }
          >
            <SecondaryButton
              style={{
                alignSelf: "flex-start",
                marginLeft: 0,
                marginTop: 0,
                marginBottom: 8,
              }}
              textStyle={{ fontSize: 12 }}
              onPress={goHome}
            >
              Volver al inicio
            </SecondaryButton>
            <Header
              compact
              title="Anota la venta del día!"
              subtitle={now.format("dddd, D [de] MMMM")}
            />
            {availableProducts.map((product) => (
              <View key={product.productId}>
                <FieldLabel>{product.name}</FieldLabel>
                <StyledInput
                  showSoftInputOnFocus={false}
                  onFocus={() => setActiveSalesId(product.productId)}
                  keyboardType="numeric"
                  value={getQtyString(product.productId)}
                  onChangeText={(text) => upsertQty(product, text)}
                  placeholder="Ingrese cantidad"
                />
              </View>
            ))}
            <Hint>
              Solo tienes que ingresar las cantidades vendidas, sin importar el
              monto en caja...
            </Hint>
          </PortraitStep>
        ) : null}

        {step === "confirm" ? (
          <PortraitStep>
            <Header
              compact
              title="Total de ingresos por productos"
              subtitle={now.format("dddd, D [de] MMMM")}
            />
            {salesItems.map((item) => (
              <View
                key={item.productId}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <FieldLabel style={{ flex: 1 }}>
                  {item.qty} {item.name}
                </FieldLabel>
                <AmountText>
                  {Dinero({
                    amount: item.qty * item.price,
                    currency: "MXN",
                  }).toFormat("$0,0.00")}
                </AmountText>
              </View>
            ))}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <TotalText>total: </TotalText>
              <TotalText>
                {Dinero({
                  amount: salesConfirmTotal,
                  currency: "MXN",
                }).toFormat("$0,0.00")}
              </TotalText>
            </View>
            <View style={{ marginTop: 24 }}>
              <PrimaryButton onPress={() => setStep("income")}>
                Confirmar!
              </PrimaryButton>
              <SecondaryButton
                onPress={() => {
                  resetTemporalSales();
                  setStep("sales");
                }}
              >
                Cancelar
              </SecondaryButton>
            </View>
          </PortraitStep>
        ) : null}

        {step === "income" ? (
          <PortraitStep
            keypad={
              <NumericKeypad
                compact
                activeId={activeIncomeId}
                onKeyPress={onIncomeKeypadPress}
                canSubmit={canSubmitIncome}
                onSubmit={submitIncome}
              />
            }
          >
            <Header compact title="Corte de caja!" subtitle="Ingresos" />
            <FieldLabel>Cuánto hay en caja?</FieldLabel>
            <StyledInput
              showSoftInputOnFocus={false}
              keyboardType="numeric"
              value={cashText}
              onFocus={() => {
                Keyboard.dismiss();
                setActiveIncomeId("cash");
              }}
              onChangeText={(text) => setCashText(text.replace(/[^\d]/g, ""))}
              placeholder="Ingrese cantidad"
            />
            <FieldLabel>Cuánto hay en depósitos?</FieldLabel>
            <StyledInput
              showSoftInputOnFocus={false}
              keyboardType="numeric"
              value={bankText}
              onFocus={() => {
                Keyboard.dismiss();
                setActiveIncomeId("bank");
              }}
              onChangeText={(text) => setBankText(text.replace(/[^\d]/g, ""))}
              placeholder="Ingrese cantidad"
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                opacity: incomeTotal > 0 ? 1 : 0.2,
              }}
            >
              <TotalText>Total de ingresos: </TotalText>
              <TotalText>
                {Dinero({ amount: incomeTotal, currency: "MXN" }).toFormat(
                  "$0,0.00",
                )}
              </TotalText>
            </View>
          </PortraitStep>
        ) : null}

        {step === "outcome" ? (
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              if (notesActive) {
                Keyboard.dismiss();
                setNotesActive(false);
              }
            }}
          >
            <PortraitStep
              keypad={
                notesActive ? null : (
                  <NumericKeypad
                    compact
                    activeId={activeOutcomeId}
                    onKeyPress={onOutcomeKeypadPress}
                    canSubmit={canSubmitOutcome}
                    onSubmit={submitOutcome}
                  />
                )
              }
            >
              <Header compact title="Corte de caja!" subtitle="Egresos" />
              <FieldLabel>
                ¿Cuánto se pagó a repartidores (efectivo)?
              </FieldLabel>
              <StyledInput
                value={deliveryText}
                keyboardType="numeric"
                showSoftInputOnFocus={false}
                onFocus={() => {
                  Keyboard.dismiss();
                  setNotesActive(false);
                  setActiveOutcomeId("delivery");
                }}
                onChangeText={(text) =>
                  setDeliveryText(text.replace(/[^\d]/g, ""))
                }
                placeholder="Ej. 250"
              />
              <FieldLabel>¿Otros gastos en efectivo?</FieldLabel>
              <StyledInput
                value={otherText}
                keyboardType="numeric"
                showSoftInputOnFocus={false}
                onFocus={() => {
                  Keyboard.dismiss();
                  setNotesActive(false);
                  setActiveOutcomeId("other");
                }}
                onChangeText={(text) =>
                  setOtherText(text.replace(/[^\d]/g, ""))
                }
                placeholder="Ej. 80"
              />
              <FieldLabel>¿Algún comentario o nota?</FieldLabel>
              <NotesInput
                value={notes}
                onFocus={() => {
                  setActiveOutcomeId(null);
                  setNotesActive(true);
                }}
                onChangeText={setNotes}
                placeholder="Ej. Se pagó gas / faltó cambio / etc."
                multiline
                numberOfLines={4}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  opacity: outcomeTotal > 0 ? 1 : 0.2,
                }}
              >
                <TotalText>Total de egresos: </TotalText>
                <TotalText>
                  {Dinero({ amount: outcomeTotal, currency: "MXN" }).toFormat(
                    "$0,0.00",
                  )}
                </TotalText>
              </View>
              {notesActive && canSubmitOutcome ? (
                <PrimaryButton onPress={submitOutcome}>
                  Enviar Reporte!
                </PrimaryButton>
              ) : null}
            </PortraitStep>
          </Pressable>
        ) : null}

        {step === "evidence" ? (
          <PortraitCloseEvidenceStep
            photos={evidencePhotos}
            onChange={setEvidencePhotos}
            onContinue={submitEvidence}
          />
        ) : null}

        {step === "resume" ? (
          <PortraitStep>
            <Header
              compact
              title="Confirmacion!"
              subtitle={dayjs(temporalSale.date).format("dddd, D [de] MMMM")}
            />
            <View
              style={{
                flexDirection: "row",
                marginBottom: 16,
                marginHorizontal: -10,
              }}
            >
              <Resume
                data={{
                  key: "Ingresos",
                  value:
                    (temporalSale.cashReceived || 0) +
                    (temporalSale.bankTransfersReceived || 0),
                }}
              />
              <Resume
                data={{
                  key: "Egresos",
                  value:
                    (temporalSale.deliveryCashPaid || 0) +
                    (temporalSale.otherCashExpenses || 0),
                }}
              />
              <Resume
                data={{
                  key: "Total",
                  value:
                    (temporalSale.cashReceived || 0) +
                    (temporalSale.bankTransfersReceived || 0) -
                    ((temporalSale.deliveryCashPaid || 0) +
                      (temporalSale.otherCashExpenses || 0)),
                }}
              />
            </View>
            <FieldLabel style={{ fontWeight: "600", color: "#2d2d2dff" }}>
              Ingresos por productos
            </FieldLabel>
            {salesItems.map((item) => (
              <View
                key={item.productId}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <FieldLabel style={{ flex: 1 }}>
                  {item.qty} {item.name}
                </FieldLabel>
                <AmountText>
                  {Dinero({
                    amount: item.qty * item.price,
                    currency: "MXN",
                  }).toFormat("$0,0.00")}
                </AmountText>
              </View>
            ))}
            <View style={{ alignItems: "flex-end", marginTop: 8 }}>
              <FieldLabel style={{ fontWeight: "700", color: "#2d2d2dff" }}>
                Total ingresos:{" "}
                {Dinero({
                  amount: salesConfirmTotal,
                  currency: "MXN",
                }).toFormat("$0,0.00")}
              </FieldLabel>
            </View>
            <FieldLabel style={{ fontWeight: "600", color: "#2d2d2dff" }}>
              Evidencias
            </FieldLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {CLOSE_EVIDENCE_SLOTS.map((slot) => {
                const photo = evidencePhotos.find(
                  (item) => item.kind === slot.kind,
                );
                return (
                  <View
                    key={slot.kind}
                    style={{ width: "47%", marginBottom: 8 }}
                  >
                    {photo ? (
                      <Image
                        source={{ uri: photo.localUri }}
                        style={{
                          width: "100%",
                          height: 88,
                          borderRadius: 8,
                          backgroundColor: "#e2e8f0",
                        }}
                      />
                    ) : null}
                    <FieldLabel>{slot.label}</FieldLabel>
                  </View>
                );
              })}
            </View>
            <View style={{ marginTop: 24 }}>
              <PrimaryButton onPress={submitClose}>
                Confirmar y Guardar
              </PrimaryButton>
              <SecondaryButton onPress={confirmCancel}>
                Cancelar
              </SecondaryButton>
            </View>
          </PortraitStep>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const PortraitStep = ({
  children,
  keypad,
}: {
  children: React.ReactNode;
  keypad?: React.ReactNode;
}) => (
  <View style={{ flex: 1 }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
    {keypad ? (
      <View style={{ alignItems: "center", paddingBottom: 12 }}>{keypad}</View>
    ) : null}
  </View>
);

const FieldLabel = styled.Text`
  color: #aaaaaa;
  margin-top: 10px;
  margin-bottom: 8px;
`;

const StyledInput = styled.TextInput`
  border-width: 1px;
  border-color: ${Black};
  padding: 8px 16px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 22px;
`;

const NotesInput = styled.TextInput`
  border-width: 1px;
  border-color: ${Black};
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 18px;
  min-height: 90px;
`;

const TotalText = styled.Text`
  font-size: 20px;
`;

const AmountText = styled.Text`
  color: #2d2d2dff;
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 18px;
`;
