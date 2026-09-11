"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getBackendApiBaseUrl } from "@/lib/auth";
import { getWorkspaceSession } from "@/lib/taku-api";
import type { RealtimeEnvelope } from "./types";

export type InboxSocketStatus = "connecting" | "connected" | "disconnected";

function getBackendSocketUrl() {
  return getBackendApiBaseUrl().replace(/\/api\/?$/, "");
}

export function useInboxRealtime(params: {
  enabled: boolean;
  onMessageCreated: (payload: unknown) => void;
  onConversationUpdated: (payload: unknown) => void;
  onReconnect: () => void;
}) {
  const [status, setStatus] = useState<InboxSocketStatus>("disconnected");
  const handlersRef = useRef(params);
  handlersRef.current = params;

  useEffect(() => {
    if (!params.enabled) {
      setStatus("disconnected");
      return;
    }

    const session = getWorkspaceSession();
    if (!session) {
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");
    const socket: Socket = io(getBackendSocketUrl(), {
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: {
        accessToken: session.accessToken,
        workspaceId: session.currentWorkspace.id,
      },
    });

    const unwrap = (incoming: unknown) => {
      if (incoming && typeof incoming === "object" && "data" in incoming) {
        return (incoming as RealtimeEnvelope).data;
      }
      return incoming;
    };

    socket.on("connect", () => {
      setStatus("connected");
    });
    socket.on("disconnect", () => {
      setStatus("disconnected");
    });
    socket.on("connect_error", () => {
      setStatus("disconnected");
    });
    socket.io.on("reconnect", () => {
      setStatus("connected");
      handlersRef.current.onReconnect();
    });
    socket.on("message.created", (incoming: unknown) => {
      handlersRef.current.onMessageCreated(unwrap(incoming));
    });
    socket.on("conversation.updated", (incoming: unknown) => {
      handlersRef.current.onConversationUpdated(unwrap(incoming));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [params.enabled]);

  return status;
}
