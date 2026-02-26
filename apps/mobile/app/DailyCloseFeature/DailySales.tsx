import { Theme } from "@/constants/Colors";
import React, { useMemo, useState } from "react";
import styled from "styled-components/native";
import dayjs from "dayjs";
import { ScrollView, View } from "react-native";
import { RootStackParamList } from "./NavigationStack";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Hint } from "@/components/Typography";
import { useDailyCloseStore } from "./useDailyCloseStore";
import { ProductSale, Screens } from "./Types";
import { Header } from "./WrapperComponents";
import NumericKeypad from "../../components/ui/NumericKeyPad";
import { SecondaryButton } from "@/components/ui/Buttons";

const { Black } = Theme;

type Props = NativeStackScreenProps<
  RootStackParamList,
  Screens.DailySalesScreen
>;

// TODO: make this kid of a wizzard, ask the amount per item and just wait for the number until no more itmes to save
export default ({ navigation: { navigate } }: Props) => {
  const now = useMemo(() => dayjs(), []);
  const availableProducts = useDailyCloseStore(
    (state) => state.availableProducts,
  );
  const [localTemporalSaleItems, setLocalTemporalSaleItems] = useState<
    ProductSale[]
  >([]);
  const setTemporalSaleItems = useDailyCloseStore(
    (state) => state.setTemporalSaleItems,
  );

  const canSubmit = localTemporalSaleItems.length === availableProducts.length;
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

      // remove if empty/invalid
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

  const onKeypadPress = (key: KeypadKey) => {
    if (!activeId) return;

    const product = availableProducts.find((p) => p.productId === activeId);
    if (!product) return;

    const current = getQtyString(activeId);

    let next = current;

    if (key === "Del") next = current.slice(0, -1);
    else if (key === "Clear") next = "";
    else next = current === "0" ? key : current + key; // optional: avoid leading zeros

    upsertQty(product, next);
  };
  const submitReport = () => {
    setTemporalSaleItems(localTemporalSaleItems);
    navigate(Screens.DailySalesConfirmScreen);
  };

  // handle input focus to show number pad
  const [activeId, setActiveId] = useState<string | null>(null);

  const generalOnchangeText = (
    text: string,
    product: Omit<ProductSale, "qty">,
  ) => {
    setLocalTemporalSaleItems((prev) => {
      const selectedIndex = prev.findIndex(
        (sp) => sp.productId === product.productId,
      );

      // TODO if parse int is Nan is because is not a number, fix this
      const newItem = {
        productId: product.productId,
        name: product.name,
        price: product.price,
        qty: parseInt(text),
      } as ProductSale;
      if (selectedIndex !== -1) {
        const newSale = [...prev];
        if (newItem.qty >= 0) {
          newSale.splice(selectedIndex, 1, newItem);
        } else {
          // remove the item
          newSale.splice(selectedIndex, 1);
        }
        return newSale;
      }
      return [...prev, newItem];
    });
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flex: 1, flexDirection: "row", minHeight: 560 }}>
        <View style={{ flex: 1 }}>
          <SecondaryButton
            style={{
              alignSelf: "flex-start",
              marginLeft: 0,
              marginTop: 0,
              marginBottom: 12,
            }}
            textStyle={{ fontSize: 12 }}
            onPress={() => navigate(Screens.LandingScreen)}
          >
            Volver al inicio
          </SecondaryButton>
          <Header
            title={"Anota la venta del día!"}
            subtitle={now.format("dddd, D [de] MMMM")}
          />
          {availableProducts.map((p) => {
            return (
              <View style={{ display: "flex", flex: 0 }} key={p.productId}>
                <Label>{p.name}</Label>
                <StyledInput
                  showSoftInputOnFocus={false}
                  onFocus={() => setActiveId(p.productId)}
                  keyboardType="numeric"
                  value={(
                    localTemporalSaleItems.find(
                      (si) => si.productId === p.productId,
                    )?.qty || ""
                  ).toString()}
                  onChangeText={(e) => {
                    generalOnchangeText(e, p);
                  }}
                  placeholder="Ingrese cantidad"
                />
              </View>
            );
          })}
          <Hint>
            Solo tienes que ingresar las cantidades vendidas, sin importar el
            monto en caja...
          </Hint>
        </View>
        <View style={{ flex: 1, alignItems: "center", marginTop: 30 }}>
          <NumericKeypad
            activeId={activeId}
            onKeyPress={onKeypadPress}
            canSubmit={canSubmit}
            onSubmit={submitReport}
          />
        </View>
      </View>
    </ScrollView>
  );
};

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
