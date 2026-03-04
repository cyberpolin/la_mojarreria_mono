interface RelatedOrder {
  id: string;
  status: string;
}

interface Order {
  id: string;
  client: { id: string; name: string; phone: string };
  products: Array<{
    id: string;
    name: string;
    price: number;
    timeProcess: number;
  }>;
  productsWithAmount: any;
  isDelivery: boolean;
  address?: string;
  deliveryCost?: number;
  deliveryTime?: number;
  notes?: string;
  relatedOrders?: RelatedOrder[];
  status: string;
  createdAt: string;
  active: boolean;
}

interface OrderGroup {
  orders: Order[];
}

const getGroupOrders = async (
  root: any,
  _args: any,
  context: any,
): Promise<Order[][]> => {
  try {
    const today = new Date();
    const todayStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const todayEnd = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const orders = await context.query.Order.findMany({
      where: {
        createdAt: {
          gt: todayStart.toISOString(),
          lt: todayEnd.toISOString(),
        },
        active: { equals: true },
      },
      query: `id
        client { id name phone }
        products{id name price timeProcess}
        productsWithAmount
        isDelivery
        address
        deliveryCost
        deliveryTime
        notes
        relatedOrders {id status}
        status
        createdAt`,
    });

    if (!orders || orders.length === 0) {
      return [];
    }

    const groupRelatedOrders = (orders: Order[]): Order[][] => {
      if (!orders?.length) return [];

      const orderMap = new Map<string, Order>();
      const groups: Order[][] = [];
      const visited = new Set<string>();

      orders.forEach((order) => order.id && orderMap.set(order.id, order));

      const collectGroup = (orderId: string, group: Order[]) => {
        if (visited.has(orderId)) return;

        const order = orderMap.get(orderId);
        if (!order) return;

        visited.add(orderId);
        group.push(order);

        order.relatedOrders?.forEach(({ id }) => collectGroup(id, group));

        orders.forEach((o) => {
          if (o.relatedOrders?.some(({ id }) => id === orderId)) {
            collectGroup(o.id, group);
          }
        });
      };

      orders.forEach((order) => {
        if (!order.id || visited.has(order.id)) return;

        const group: Order[] = [];
        collectGroup(order.id, group);
        groups.push(group);
      });

      return groups;
    };

    return groupRelatedOrders(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    throw new Error("Failed to fetch orders");
  }
};

export default getGroupOrders;
