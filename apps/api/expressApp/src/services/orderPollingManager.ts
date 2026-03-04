import { prisma } from "../../../keystone";

type OrderListener = (orderUpdates: any[]) => void;

const listeners: Record<string, OrderListener> = {};

export const registerPolling = async (
  listenerId: string,
  res: any,
  timeoutMs = 30000,
) => {
  const key = `${listenerId}`;

  // console.log(`🛎️  Nuevo polling registrado ListenerID: ${listenerId}---`);
  // console.log(`---  Total amount of polling ---`);
  // console.log(
  //   `---  Total amount of listeners ${JSON.stringify(listeners)} ---`
  // );

  const items = await prisma.listener.create({
    data: {
      listenerId,
    },
  });

  listeners[key] = (orders: any) => {
    res.json({ orders: orders });
  };
};

export async function dispatchOrders(orders: any, listenerId?: string[]) {
  if (!listenerId || listenerId.length === 0) return;

  for (const key of listenerId) {
    if (listeners[key]) {
      try {
        listeners[key](orders);
      } catch (error) {
        console.error(`Error in listener ${key}:`, error);
      }
    }
  }
  console.log("the polling is end");
}
