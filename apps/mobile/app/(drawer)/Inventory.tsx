import React, { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "@apollo/client";
import { INITIAL_STOCK, UPDATE_STOCK, GET_MATERIALS } from "./queries.gql";
import styled from "styled-components/native";
import Check from "@/components/ui/Check";
import HContanier from "@/components/ui/HContanier";
import BTN from "@/components/ui/BTN";
import Loader from "@/components/ui/Loader";
import Logo from "@/components/ui/Logo";
import { Theme } from "@/constants/Colors";
import {
  Alert,
  Text,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
const { Black } = Theme;

type MaterialItem = {
  id: string;
  label: string;
  checked: boolean;
  small?: boolean;
  unit?: string;
};

type MaterialsQueryData = {
  rawMaterials: Array<{
    id: string;
    name: string;
    unit?: string;
  }>;
};

type InventoryProps = {
  logout: () => void;
  route?: unknown;
  navigation: {
    replace: (screen: string) => void;
  };
};

export default function Inventory({
  logout,
  route: _route,
  navigation,
}: InventoryProps) {
  const [caja, setCaja] = React.useState("");
  const [mojarras, setMojarras] = React.useState("");
  const [stockID, setStockID] = React.useState<string | null>(null);
  const [cashRegister, setCashRegister] = React.useState<string | null>(null);

  const { data, loading, error } = useQuery<MaterialsQueryData>(GET_MATERIALS);

  const [inicialBoxes, setInicialBoxes] = React.useState<
    Record<string, MaterialItem>
  >({
    ensaladas: { id: "ensaladas", label: "¿Ensaladas listas?", checked: false },
    tinas: { id: "tinas", label: "¿Tinas listas?", checked: false },
    areaMesa: { id: "areaMesa", label: "¿Área de mesa lista?", checked: false },
  });

  const [materialBoxes, setMaterialBoxes] = React.useState<
    Record<string, MaterialItem>
  >({});

  // Initialize material boxes when data is loaded
  useEffect(() => {
    if (data?.rawMaterials) {
      const initialMaterials = data.rawMaterials.reduce(
        (acc, material) => {
          acc[material.id] = {
            id: material.id,
            label: `${material.name}`,
            checked: false,
            small: true,
            unit: material.unit,
          };
          return acc;
        },
        {} as Record<string, MaterialItem>,
      );

      setMaterialBoxes(initialMaterials);
    }
  }, [data]);

  const [createStock, { loading: stockInitialLoading }] = useMutation(
    INITIAL_STOCK,
    {
      variables: {
        cash: {
          openingBalance: parseFloat(caja),
        },
        stock: {
          quantity: parseFloat(mojarras),
          product: {
            connect: { id: "6f785de0-817a-4fba-b4c9-80e006d466cb" },
          },
        },
      },
      onError: (error) => console.error("createStock error", error),
      onCompleted: async (data) => {
        await AsyncStorage.setItem("stockID", data.createStock.id);
        await AsyncStorage.setItem("cashRegister", data.createCashRegister.id);
      },
    },
  );

  const [updateStock, { loading: stockFinalLoading }] = useMutation(
    UPDATE_STOCK,
    {
      onError: (error) => console.error("updateStock error", error),
    },
  );

  const handleUpdateStock = async () => {
    console.log("stockID", stockID, "cashRegister", cashRegister);

    if (!stockID || !cashRegister) {
      console.error("Faltan stockID o cashRegister");
      return;
    }

    try {
      await updateStock({
        variables: {
          cashID: {
            id: cashRegister,
          },
          cash: {
            status: "closed",
            closingBalance: parseFloat(caja),
            notes: `Faltas: ${Object.values(materialBoxes)
              .filter((item) => item.checked)
              .map((item) => item.label)
              .join(", ")}`,
          },
          stockID: {
            id: stockID,
          },
          stock: {
            quantity: parseFloat(mojarras),
            product: {
              connect: { id: "6f785de0-817a-4fba-b4c9-80e006d466cb" },
            },
          },
        },
      });
    } catch (error) {
      console.error("Error in updateStock:", error);
    }
  };

  const handleCheckboxChange = (id: string) => {
    Keyboard.dismiss();
    if (stockID && cashRegister) {
      setMaterialBoxes((prev) => ({
        ...prev,
        [id]: { ...prev[id], checked: !prev[id]?.checked },
      }));
    } else {
      setInicialBoxes((prev) => ({
        ...prev,
        [id]: { ...prev[id], checked: !prev[id].checked },
      }));
    }
  };

  const texts =
    stockID && cashRegister
      ? {
          title: "Finalizar",
          question1: "¿Cuánto quedó en caja?",
          BTN: "Finalizar",
          onPress: "¿Estás seguro de que quieres cerrar sesión?",
          alert: "cerrar sesion",
        }
      : {
          title: "Iniciar Jornada",
          question1: "¿Cuánto hay en caja?",
          BTN: "Iniciar Jornada",
          onPress: "¿Estás seguro de que quieres iniciar la jornada?",
          alert: "iniciar jornada",
        };

  const handlePress = () => {
    Alert.alert(texts.alert, texts.onPress, [
      {
        text: "Cancelar",
        style: "cancel",
        onPress: () => {},
      },
      {
        text: texts.alert,
        onPress: async () => {
          if (stockID && cashRegister) {
            await handleUpdateStock();
            await AsyncStorage.multiRemove([
              "stockID",
              "cashRegister",
              "inBoard",
            ]);
            logout();
          } else {
            await createStock();
            navigation.replace("Board");
          }
        },
      },
    ]);
  };

  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const storedStockID = await AsyncStorage.getItem("stockID");
        const storedCashRegister = await AsyncStorage.getItem("cashRegister");
        setStockID(storedStockID);
        setCashRegister(storedCashRegister);
      } catch (error) {
        console.error("Error loading storage data:", error);
      }
    };

    loadStorageData();
  }, []);

  if (loading) return <Loader />;
  if (error) return <Text>Error: {error.message}</Text>;

  return (
    <HContanier longpressIsActive>
      <Header>
        <Logo />
        <Title>{texts.title}</Title>
      </Header>
      <Form>
        <Column>
          <Label>{texts.question1}</Label>
          <StyledInput
            keyboardType="numeric"
            value={caja}
            onChangeText={setCaja}
            placeholder="Ingrese cantidad"
          />
          <Label>¿Cuántas Mojarras hay?</Label>
          <StyledInput
            keyboardType="numeric"
            value={mojarras}
            onChangeText={setMojarras}
            placeholder="Ingrese cantidad"
          />
          <BTN
            text={texts.BTN}
            disabled={
              stockID && cashRegister
                ? !caja || !mojarras
                : !caja ||
                  !mojarras ||
                  !Object.values(inicialBoxes).every((item) => item.checked)
            }
            onPress={handlePress}
            loading={stockFinalLoading || stockInitialLoading}
          />
        </Column>

        <ColumnRight>
          {stockID && cashRegister ? (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "height" : "padding"}
              style={{ flex: 2 }}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                <Infolabel>¿Qué hace falta?</Infolabel>
                {Object.values(materialBoxes).map((item) => (
                  <CheckboxRow
                    key={item.id}
                    small={item.small}
                    onPress={() => handleCheckboxChange(item.id)}
                  >
                    <CheckLabel>{item.label}</CheckLabel>
                    <Check
                      status={item.checked ? "checked" : "unchecked"}
                      onPress={() => handleCheckboxChange(item.id)}
                    />
                  </CheckboxRow>
                ))}
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            Object.values(inicialBoxes).map((item) => (
              // check to do
              <CheckboxRow
                key={item.id}
                onPress={() => handleCheckboxChange(item.id)}
              >
                <CheckLabel>{item.label}</CheckLabel>
                <Check
                  status={item.checked ? "checked" : "unchecked"}
                  onPress={() => handleCheckboxChange(item.id)}
                />
              </CheckboxRow>
            ))
          )}
        </ColumnRight>
      </Form>
    </HContanier>
  );
}

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const Form = styled.View`
  flex-direction: row;
  justify-content: space-between;
  flex: 1;
`;

const Column = styled.View`
  flex: 1;
  justify-content: space-between;
`;

const ColumnRight = styled.View`
  flex: 1;
  justify-content: flex-start;
  padding-left: 24px;
`;

const Title = styled.Text`
  font-size: 40px;
  font-weight: bold;
  color: ${Black};
`;

const Label = styled.Text`
  font-size: 28px;
  color: ${Black};
`;

const Infolabel = styled(Label)`
  font-weight: bold;
  color: ${Black};
  margin-bottom: 20px;
`;

const StyledInput = styled.TextInput`
  border-width: 1px;
  border-color: ${Black};
  padding: 10px 16px;
  border-radius: 8px;
  margin-bottom: 40px;
  font-size: 26px;
`;

const CheckboxRow = styled.TouchableOpacity<{ small?: boolean }>`
  flex-direction: row;
  align-items: center;
  margin-bottom: ${(props) => (props.small ? "30px" : "40px")};
`;

const CheckLabel = styled.Text`
  flex: 1;
  font-size: 28px;
  margin-right: 10px;
`;
