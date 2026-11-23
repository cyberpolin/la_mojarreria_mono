import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { verifyToken } from "./auth.js";
import type { JsonStore } from "./store/jsonStore.js";

export function createRealtimeServer(httpServer: HttpServer, store: JsonStore) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.allowedOrigins,
      credentials: true,
    },
  });

  io.on("connection", async (socket) => {
    const accessToken = socket.handshake.auth?.accessToken;
    const workspaceId = socket.handshake.auth?.workspaceId;
    if (typeof accessToken !== "string" || typeof workspaceId !== "string") {
      socket.disconnect(true);
      return;
    }
    const payload = verifyToken<{ sub?: unknown }>(
      accessToken,
      config.jwtSecret,
    );
    const userId = typeof payload?.sub === "string" ? payload.sub : null;
    if (!userId) {
      socket.disconnect(true);
      return;
    }
    const database = await store.read();
    const membership = database.memberships.find(
      (item) =>
        item.userId === userId &&
        item.workspaceId === workspaceId &&
        item.status === "active",
    );
    if (!membership) {
      socket.disconnect(true);
      return;
    }
    socket.join(`workspace:${workspaceId}`);
    socket.emit("connected", { workspaceId, role: membership.role });
  });

  return {
    io,
    emitToWorkspace(workspaceId: string, event: string, data: unknown) {
      io.to(`workspace:${workspaceId}`).emit(event, { event, data });
    },
  };
}

export type Realtime = ReturnType<typeof createRealtimeServer>;
