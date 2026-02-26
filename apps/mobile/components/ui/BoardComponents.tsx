import { useState, useEffect } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { Theme } from "@/constants/Colors";
import styled from "styled-components/native";

export type Order = {
  id: string;
  status: "pending" | "inProgress" | "completed" | "delivered" | "canceled";
  productsWithAmount: string;
  createdAt: string;
  isDelivery: boolean;
  deliveryCost?: number;
  client?: {
    name: string;
    phone: string;
  };
  address?: string;
  relatedOrders?: Order[];
};
export type Product = {
  name?: string;
  amount?: number;
  price?: number;
  timeProcess?: string;
};

type OrderButtonProps = {
  iconSize?: number;
  onPress: () => void;
  children?: React.ReactNode;
  order?: Order;
  groupLength?: number;
};

const {
  Primary,
  Gray,
  GrayLighter,
  RedLighter,
  YellowLighter,
  Red,
  GrayLight,
} = Theme;

interface OrderCardProps {
  order: Order;
  cardType: Order["status"];
  actionText?: string;
  onAction?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  groupLength?: number;
  totalPrice?: number;
}

export const OrderCard = ({
  order,
  cardType,
  actionText = "",
  onAction,
  isFirst = true,
  isLast = true,
  groupLength = 1,
  totalPrice = 0,
}: OrderCardProps) => {
  const { productsWithAmount, createdAt, isDelivery, deliveryCost } = order;
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const products: Product[] = JSON.parse(productsWithAmount || "[]");
  const minutesPassed = Math.floor(
    (currentTime.getTime() - new Date(createdAt).getTime()) / 60000,
  );

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timeInterval);
  }, []);

  const cookingStatus = products.reduce(
    (status: "cooked" | "almostCooked" | "inProgress", product) => {
      const cookTime = Number(product.timeProcess) || 0;
      if (minutesPassed >= cookTime) return "cooked";
      if (minutesPassed >= (cookTime * 2) / 3) return "almostCooked";
      return status;
    },
    "inProgress",
  );

  const getTotalPrice = (): number => {
    return (
      products.reduce(
        (sum: number, product: Product) =>
          sum + (product.price || 0) * (product.amount || 1),
        0,
      ) + (isDelivery ? deliveryCost || 0 : 0)
    );
  };

  return (
    <Card
      cardType={cardType}
      stateCard={cardType}
      time={cardType === "inProgress" ? cookingStatus : undefined}
      isFirst={isFirst}
      isLast={isLast}
    >
      {isFirst && groupLength > 1 && (
        <GroupHeader>
          <GroupHeaderText>
            Pedidos relacionados ({groupLength})
          </GroupHeaderText>
        </GroupHeader>
      )}
      <CardTitle>
        <LabelText>comanda # </LabelText>
        {order.client!.phone.slice(-4)}
      </CardTitle>
      <CardTitle>
        <LabelText>{isDelivery ? "envio para: " : "entregar a: "}</LabelText>
        {order.client!.name}
      </CardTitle>

      {products.map((product, idx) => (
        <CardTitle key={idx}>
          <CardNumber>{product.amount}</CardNumber> {product.name}
        </CardTitle>
      ))}

      <LabelText>
        Pedido hace: <TimeNumber>{minutesPassed} min.</TimeNumber>
      </LabelText>

      {onAction && isLast && (
        <CardButton onPress={onAction}>
          <ButtonText>{actionText || `$${totalPrice.toFixed(2)}`}</ButtonText>

          {actionText && <MaterialIcons name="east" size={25} color={Gray} />}
        </CardButton>
      )}
    </Card>
  );
};

export const OrderButton = ({
  order,
  iconSize = 35,
  onPress,
  groupLength = 1,
}: OrderButtonProps & { order?: Order; groupLength?: number }) => (
  <ArrowBtn onPress={onPress}>
    {order && groupLength > 1 && (
      <GroupBadge>
        <GroupBadgeText>{groupLength}</GroupBadgeText>
      </GroupBadge>
    )}
    <MaterialIcons name="east" size={iconSize} color={Gray} />
  </ArrowBtn>
);

const ArrowBtn = styled(TouchableOpacity)`
  width: 90px;
  height: 90px;
  border-radius: 10px;
  background-color: ${GrayLighter};
  border-width: 1px;
  border-color: ${GrayLight};
  justify-content: center;
  align-items: center;
  margin-bottom: 12px;
`;
const LabelText = styled.Text`
  font-size: 18px;
  font-weight: light;
`;

const CardNumber = styled.Text`
  font-size: 25px;
  font-weight: bold;
`;

const TimeNumber = styled.Text`
  font-size: 20px;
  font-weight: bold;
`;

const CardButton = styled(TouchableOpacity)`
  flex-direction: row;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 15px 0;
  border-radius: 4px;
  border: 1px solid ${Primary};
`;

const ButtonText = styled.Text`
  font-size: 20px;
  margin-right: 5px;
  color: ${Primary};
`;
type CardProps = {
  stateCard?: Order["status"];
  time?: "cooked" | "almostCooked" | "inProgress";
  cardType: Order["status"];
  isFirst?: boolean;
  isLast?: boolean;
};

// margin-bottom: 16px;
const Card = styled.View<CardProps>`
  padding: 12px;
  background-color: ${({ stateCard, time }) =>
    time === "almostCooked" && stateCard === "inProgress"
      ? YellowLighter
      : time === "cooked" && stateCard === "inProgress"
        ? RedLighter
        : GrayLighter};
  border-width: 1px;
  border-color: ${({ stateCard, time }) =>
    stateCard === "inProgress" && time === "cooked" ? Red : GrayLight};
  border-radius: 8px;
  border-left-width: 1px;
  border-right-width: 1px;
  border-top-width: ${({ isFirst }) => (isFirst ? "1px" : "0")};
  border-bottom-width: ${({ isLast }) => (isLast ? "1px" : "0")};
  border-top-left-radius: ${({ isFirst }) => (isFirst ? "8px" : "0")};
  border-top-right-radius: ${({ isFirst }) => (isFirst ? "8px" : "0")};
  border-bottom-left-radius: ${({ isLast }) => (isLast ? "8px" : "0")};
  border-bottom-right-radius: ${({ isLast }) => (isLast ? "8px" : "0")};
`;

const CardTitle = styled.Text`
  font-size: 25px;
`;

const GroupHeader = styled.View`
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom-width: 1px;
  border-bottom-color: #e2e8f0;
`;

const GroupHeaderText = styled.Text`
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
`;

const GroupBadge = styled.View`
  position: absolute;
  top: -8px;
  right: -8px;
  background-color: ${Primary};
  width: 24px;
  height: 24px;
  border-radius: 12px;
  justify-content: center;
  align-items: center;
  z-index: 1;
`;

const GroupBadgeText = styled.Text`
  color: white;
  font-size: 12px;
  font-weight: bold;
`;
