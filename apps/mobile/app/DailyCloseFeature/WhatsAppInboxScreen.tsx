import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import {
  fetchWhatsAppConversations,
  fetchWhatsAppMessages,
  sendWhatsAppConversationMessage,
  type WhatsAppConversation,
  type WhatsAppConversationMessage,
} from "@/utils/whatsappInboxApi";

const formatConversationTime = (value: string) => {
  const date = dayjs(value);
  if (!date.isValid()) return "";

  if (date.isSame(dayjs(), "day")) {
    return date.format("HH:mm");
  }

  return date.format("DD/MM");
};

const normalizePreview = (value: string) => value.replace(/\s+/g, " ").trim();

export default function WhatsAppInboxScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 760;
  const [conversations, setConversations] = useState<WhatsAppConversation[]>(
    [],
  );
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.phone === selectedPhone,
      ),
    [conversations, selectedPhone],
  );

  const loadConversations = useCallback(
    async (options?: { preserveSelection?: boolean }) => {
      setIsLoadingConversations(true);
      setError(null);
      try {
        const result = await fetchWhatsAppConversations(80);
        setConversations(result.conversations);
        setSelectedPhone((current) => {
          if (
            options?.preserveSelection &&
            current &&
            result.conversations.some(
              (conversation) => conversation.phone === current,
            )
          ) {
            return current;
          }

          return result.conversations[0]?.phone ?? null;
        });
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar conversaciones.",
        );
      } finally {
        setIsLoadingConversations(false);
      }
    },
    [],
  );

  const loadMessages = useCallback(async (phone: string) => {
    setIsLoadingMessages(true);
    setError(null);
    try {
      const result = await fetchWhatsAppMessages({ phone, limit: 100 });
      setMessages(
        [...result.messages].sort((left, right) =>
          left.timestamp.localeCompare(right.timestamp),
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar mensajes.",
      );
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedPhone) {
      setMessages([]);
      return;
    }

    loadMessages(selectedPhone);
  }, [loadMessages, selectedPhone]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadConversations({ preserveSelection: true }).catch(() => {});
      if (selectedPhone) {
        loadMessages(selectedPhone).catch(() => {});
      }
    }, 10_000);

    return () => clearInterval(intervalId);
  }, [loadConversations, loadMessages, selectedPhone]);

  const handleSend = async () => {
    if (!selectedPhone || isSending) return;

    const text = draft.trim();
    if (!text) return;

    setIsSending(true);
    setError(null);
    try {
      await sendWhatsAppConversationMessage({ phone: selectedPhone, text });
      setDraft("");
      await Promise.all([
        loadMessages(selectedPhone),
        loadConversations({ preserveSelection: true }),
      ]);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "No se pudo enviar el mensaje.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const renderConversation = ({ item }: { item: WhatsAppConversation }) => {
    const selected = item.phone === selectedPhone;

    return (
      <Pressable
        style={[
          styles.conversationRow,
          selected && styles.conversationSelected,
        ]}
        onPress={() => setSelectedPhone(item.phone)}
      >
        <View style={styles.avatar}>
          <Ionicons name="person" size={20} color="#0f766e" />
        </View>
        <View style={styles.conversationText}>
          <View style={styles.conversationHeader}>
            <Text style={styles.phone} numberOfLines={1}>
              {item.phone}
            </Text>
            <Text style={styles.timestamp}>
              {formatConversationTime(item.updatedAt)}
            </Text>
          </View>
          <Text style={styles.preview} numberOfLines={1}>
            {item.lastMessage.direction === "outbound" ? "Tu: " : ""}
            {normalizePreview(item.lastMessage.text)}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderMessage = ({ item }: { item: WhatsAppConversationMessage }) => {
    const outbound = item.direction === "outbound";

    return (
      <View
        style={[
          styles.messageRow,
          outbound ? styles.messageRowOutbound : styles.messageRowInbound,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            outbound
              ? styles.messageBubbleOutbound
              : styles.messageBubbleInbound,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              outbound ? styles.messageTextOutbound : styles.messageTextInbound,
            ]}
          >
            {item.text}
          </Text>
          <Text
            style={[
              styles.messageTime,
              outbound ? styles.messageTimeOutbound : styles.messageTimeInbound,
            ]}
          >
            {formatConversationTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const listPanel = (
    <View style={[styles.listPanel, isCompact && styles.compactListPanel]}>
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.title}>WhatsApp</Text>
          <Text style={styles.subtitle}>{conversations.length} chats</Text>
        </View>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => loadConversations({ preserveSelection: true })}
          disabled={isLoadingConversations}
        >
          {isLoadingConversations ? (
            <ActivityIndicator size="small" color="#0f766e" />
          ) : (
            <Ionicons name="refresh" size={22} color="#0f766e" />
          )}
        </TouchableOpacity>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.phone}
        renderItem={renderConversation}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay conversaciones todavía.</Text>
        }
      />
    </View>
  );

  const detailPanel = (
    <View style={styles.detailPanel}>
      <View style={styles.chatHeader}>
        {isCompact && selectedPhone ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedPhone(null)}
          >
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </TouchableOpacity>
        ) : null}
        <View style={styles.chatTitleGroup}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            {selectedConversation?.phone ?? "Selecciona una conversación"}
          </Text>
          <Text style={styles.chatSubtitle}>
            {selectedConversation
              ? `${selectedConversation.messageCount} mensajes`
              : "Historial y respuesta manual"}
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!selectedPhone ? (
        <View style={styles.emptyChat}>
          <Ionicons name="chatbubbles-outline" size={42} color="#64748b" />
          <Text style={styles.emptyText}>Elige un chat para responder.</Text>
        </View>
      ) : (
        <>
          {isLoadingMessages ? (
            <View style={styles.loadingMessages}>
              <ActivityIndicator color="#0f766e" />
            </View>
          ) : null}
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesContent}
          />
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Escribe una respuesta"
              placeholderTextColor="#64748b"
              style={styles.input}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!draft.trim() || isSending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!draft.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="send" size={20} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {isCompact ? (selectedPhone ? detailPanel : listPanel) : null}
      {!isCompact ? (
        <>
          {listPanel}
          {detailPanel}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#eef2f7",
  },
  listPanel: {
    width: 320,
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  compactListPanel: {
    width: "100%",
    borderRightWidth: 0,
  },
  panelHeader: {
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748b",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ccfbf1",
  },
  conversationRow: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
  },
  conversationSelected: {
    backgroundColor: "#ecfeff",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ccfbf1",
  },
  conversationText: {
    flex: 1,
    minWidth: 0,
  },
  conversationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  phone: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  timestamp: {
    fontSize: 12,
    color: "#64748b",
  },
  preview: {
    marginTop: 5,
    fontSize: 13,
    color: "#475569",
  },
  separator: {
    height: 1,
    marginLeft: 70,
    backgroundColor: "#e2e8f0",
  },
  detailPanel: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  chatHeader: {
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e2e8f0",
  },
  chatTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  chatSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748b",
  },
  errorText: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    fontWeight: "600",
  },
  emptyText: {
    padding: 18,
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
  },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingMessages: {
    position: "absolute",
    top: 88,
    alignSelf: "center",
    zIndex: 2,
  },
  messagesContent: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  messageRow: {
    flexDirection: "row",
  },
  messageRowInbound: {
    justifyContent: "flex-start",
  },
  messageRowOutbound: {
    justifyContent: "flex-end",
  },
  messageBubble: {
    maxWidth: "78%",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageBubbleInbound: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  messageBubbleOutbound: {
    backgroundColor: "#0f766e",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextInbound: {
    color: "#0f172a",
  },
  messageTextOutbound: {
    color: "#ffffff",
  },
  messageTime: {
    marginTop: 4,
    fontSize: 11,
    textAlign: "right",
  },
  messageTimeInbound: {
    color: "#64748b",
  },
  messageTimeOutbound: {
    color: "#ccfbf1",
  },
  composer: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    backgroundColor: "#ffffff",
  },
  input: {
    flex: 1,
    maxHeight: 112,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e",
  },
  sendButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
});
