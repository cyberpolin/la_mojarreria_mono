import React, { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@apollo/client";
import {
  GET_GROUPED_ORDERS,
  UPDATE_ORDER_STATUS,
  UPDATE_ORDERS_STATUS,
} from "./queries.gql";
import styled from "styled-components/native";
import HContanier from "@/components/ui/HContanier";
import BTN from "@/components/ui/BTN";
import Loader from "@/components/ui/Loader";
import Logo from "@/components/ui/Logo";
import { Alert } from "react-native";
import { OrderCard, OrderButton, Order } from "@/components/ui/BoardComponents";
import axiosInstance from "@/constants/AxiosInstance";
import AsyncStorage from "@react-native-async-storage/async-storage";

type StatusColumnProps = {
  title: string;
  orderGroups: Order[][];
  status: Order["status"];
  actionText?: string;
  onAction?: (orderGroup: Order[]) => void;
  currentTime: Date;
};

type ProductLine = {
  price?: number;
  amount?: number;
};

type BoardNavigationProps = {
  navigation: {
    navigate: (screen: string, params?: { view: string }) => void;
  };
};

type PollOrdersResponse = {
  orders: Order[][];
};

const StatusColumn = ({
  title,
  orderGroups,
  status,
  actionText,
  onAction = () => {},
  currentTime,
}: StatusColumnProps) => {
  const filteredGroups =
    orderGroups?.filter((group) =>
      group.every((order) => order.status === status),
    ) || [];

  return (
    <Column>
      <ColumnTitle>{title}</ColumnTitle>
      <ContainerScroll>
        {filteredGroups.map((orderGroup, groupIndex) => {
          return (
            <OrderGroupContainer key={`group-${groupIndex}`}>
              {orderGroup.map((order, index) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  cardType={status}
                  actionText={actionText}
                  onAction={() => onAction(orderGroup)}
                  isFirst={index === 0}
                  isLast={index === orderGroup.length - 1}
                  groupLength={orderGroup.length}
                  totalPrice={orderGroup.reduce(
                    (total, order) =>
                      total +
                      JSON.parse(order.productsWithAmount || "[]").reduce(
                        (sum: number, product: ProductLine) =>
                          sum + (product.price || 0) * (product.amount || 1),
                        0,
                      ) +
                      (order.deliveryCost || 0),
                    0,
                  )}
                />
              ))}
            </OrderGroupContainer>
          );
        })}
      </ContainerScroll>
    </Column>
  );
};

export default function Board({ navigation }: BoardNavigationProps) {
  const [orderGroups, setOrderGroups] = useState<Order[][]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const pollOrders = async () => {
    try {
      const { data } = await axiosInstance.get<PollOrdersResponse>(
        `/rest/orders/updates/${listenerId.current}`,
        { timeout: 70000 },
      );
      if (data.orders.length > 0) {
        setOrderGroups(data.orders);
      }
    } catch (error) {
      console.error("Error polling orders:", error);
    } finally {
      pollOrders();
    }
  };

  const { loading, error, data } = useQuery(GET_GROUPED_ORDERS);

  const [updateOrder] = useMutation(UPDATE_ORDER_STATUS, {
    refetchQueries: [{ query: GET_GROUPED_ORDERS }],
  });
  const [updateOrders] = useMutation(UPDATE_ORDERS_STATUS, {
    refetchQueries: [{ query: GET_GROUPED_ORDERS }],
    onCompleted: () => {
      pollOrders();
    },
  });

  const listenerId = useRef(
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  );

  const allOrders = orderGroups.flat();

  const pendingGroups = orderGroups.filter((group) =>
    group.every((order) => order.status === "pending"),
  );

  const finishAllOrders =
    allOrders.length > 0 &&
    allOrders.every(
      (order) => order.status === "delivered" || order.status === "canceled",
    );

  useEffect(() => {
    if (data?.getGroupOrders) {
      setOrderGroups(data.getGroupOrders);
    }
  }, [data?.getGroupOrders]);

  useEffect(() => {
    const initialize = async () => {
      await AsyncStorage.setItem("inBoard", "true");
    };

    initialize();
    pollOrders();
  }, []);

  const handleStatus = async (Orders: Order[], status: Order["status"]) => {
    try {
      if (Orders.length === 1) {
        await updateOrder({
          variables: { id: Orders[0].id, status },
        });
      } else {
        await updateOrders({
          variables: {
            data: Orders.map((order) => ({
              where: { id: order.id },
              data: { status },
            })),
          },
        });
      }
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };
  const confirmAction = (
    title: string,
    message: string,
    actions: Array<{ text: string; style?: "cancel"; onPress?: () => void }>,
  ) => {
    Alert.alert(title, message, actions);
  };

  if (loading) return <Loader />;
  if (error) return <CardTitle>Error: {error.message}</CardTitle>;

  return (
    <HContanier row longpressIsActive>
      <Sidebar>
        <Logo />
        <ArrowScrollView>
          {pendingGroups.map((orderGroup, groupIndex) => (
            <PendingOrderGroup key={`group-${groupIndex}`}>
              {orderGroup.map((order, index) => (
                <OrderButton
                  key={order.id}
                  order={order}
                  groupLength={orderGroup.length}
                  onPress={() =>
                    confirmAction(
                      "Confirmar",
                      `¿Preparar ${
                        orderGroup.length > 1
                          ? "este grupo de órdenes"
                          : "esta orden"
                      }?`,
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Sí, preparar",
                          onPress: () => {
                            handleStatus(orderGroup, "inProgress");
                          },
                        },
                      ],
                    )
                  }
                />
              ))}
            </PendingOrderGroup>
          ))}
        </ArrowScrollView>
        {finishAllOrders && (
          <BTN
            margin="10px 0 0 0"
            padding="8px 8px"
            width="140px"
            text="Finalizar"
            onPress={() =>
              confirmAction(
                "Confirmar",
                "¿Estás seguro de que quieres finalizar la jornada?",
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Sí, finalizar",
                    onPress: () => navigation.navigate("Inventory"),
                  },
                ],
              )
            }
          />
        )}
      </Sidebar>

      <MainContent>
        <StatusColumn
          title="En Proceso"
          orderGroups={orderGroups}
          status="inProgress"
          actionText="Pedido listo"
          onAction={(orderGroup) =>
            confirmAction(
              "Confirmar",
              `¿Estás seguro de que quieres marcar como ${
                orderGroup.length > 1
                  ? "listos estos pedidos?"
                  : "listo este pedido?"
              }?`,
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Sí, marcar como listo",
                  onPress: () => {
                    handleStatus(orderGroup, "completed");
                  },
                },
              ],
            )
          }
          currentTime={currentTime}
        />

        <StatusColumn
          title="Listas"
          orderGroups={orderGroups}
          status="completed"
          actionText="Entregado"
          onAction={(orderGroup) =>
            confirmAction(
              "Confirmar",
              `¿Estás seguro de que quieres marcar como ${
                orderGroup.length > 1
                  ? "entregados estos pedidos?"
                  : "entregado este pedido?"
              }?`,
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Sí, marcar como entregado",
                  onPress: () => {
                    handleStatus(orderGroup, "delivered");
                  },
                },
              ],
            )
          }
          currentTime={currentTime}
        />

        <StatusColumn
          title="Entregado"
          orderGroups={orderGroups}
          status="delivered"
          currentTime={currentTime}
        />
      </MainContent>
    </HContanier>
  );
}

const Sidebar = styled.View`
  width: 140px;
  justify-content: flex-start;
  align-items: center;
  margin-right: 12px;
`;

const ArrowScrollView = styled.ScrollView.attrs({
  showsHorizontalScrollIndicator: false,
  showsVerticalScrollIndicator: false,
})`
  flex-grow: 1;
`;

const MainContent = styled.View`
  flex-direction: row;
  flex: 1;
  gap: 12px;
  margin-top: 10px;
`;

const Column = styled.View`
  flex: 1;
  margin-top: 10px;
`;

const ContainerScroll = styled(ArrowScrollView)`
  flex: 1;
`;

const ColumnTitle = styled.Text`
  font-size: 22px;
  font-weight: bold;
  width: 100%;
  text-align: center;
  margin-bottom: 16px;
`;

const CardTitle = styled.Text`
  font-size: 25px;
  margin-top: 50px;
`;

const OrderGroupContainer = styled.View`
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
`;

const PendingOrderGroup = styled.View`
  margin-bottom: 12px;
`;
