import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Screens } from "./Types";
import type { RootStackParamList } from "./NavigationStack";
import { APP_CONFIG } from "@/constants/config";

type PromoRegistration = {
  phone: string;
  name: string;
  campaignKey: string;
  status: "active";
  createdAt: string;
  updatedAt: string;
  activatedAt: string;
};

type ActivePromoContact = {
  phone: string;
  lastText: string;
  lastMessageId: string;
  lastReceivedAt: string;
  messageCount: number;
  registration: PromoRegistration;
};

const getPromoId = (contact: ActivePromoContact) =>
  `${contact.registration.campaignKey}:${contact.registration.phone}`;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const getWaApiBaseUrl = () =>
  (APP_CONFIG.waApiBaseUrl || "https://api.wa.lamojarreria.com").replace(
    /\/$/,
    "",
  );

const isActivePromosPayload = (
  value: unknown,
): value is { contacts: ActivePromoContact[] } =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { contacts?: unknown }).contacts);

export default function ActivePromosScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [contacts, setContacts] = useState<ActivePromoContact[]>([]);
  const [pendingPromoId, setPendingPromoId] = useState<string | null>(null);
  const [loadingPromos, setLoadingPromos] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadPromos = useCallback(
    async (
      options: {
        showLoading?: boolean;
        cancelledRef?: () => boolean;
      } = {},
    ) => {
      const showLoading = options.showLoading ?? true;

      if (showLoading) {
        setLoadingPromos(true);
      }
      setLoadError(null);

      try {
        if (!APP_CONFIG.waApiKey) {
          throw new Error("EXPO_PUBLIC_MOJARRERIA_WA_API_KEY is required.");
        }

        const url = `${getWaApiBaseUrl()}/messages/inbound/recent-active-promos?limit=50`;
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            "x-api-key": APP_CONFIG.waApiKey,
            "x-client-domain": APP_CONFIG.waClientDomain,
          },
        });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const error =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof payload.error === "string"
              ? payload.error
              : null;
          throw new Error(
            error ?? `No se pudieron cargar promociones (${response.status}).`,
          );
        }

        if (!isActivePromosPayload(payload)) {
          throw new Error(
            "La respuesta de promociones no tiene el formato esperado.",
          );
        }

        if (!options.cancelledRef?.()) {
          setContacts(payload.contacts);
        }
      } catch (error) {
        if (!options.cancelledRef?.()) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar promociones.",
          );
        }
      } finally {
        if (showLoading && !options.cancelledRef?.()) {
          setLoadingPromos(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadInitialPromos = async () => {
      await loadPromos({ cancelledRef: () => cancelled });
    };

    void loadInitialPromos();

    return () => {
      cancelled = true;
    };
  }, [loadPromos]);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;

    return contacts.filter((contact) => {
      const name = contact.registration.name.toLowerCase();
      return name.includes(query) || contact.phone.includes(query);
    });
  }, [contacts, search]);

  const activeCount = contacts.length;

  const markAsUsed = (contact: ActivePromoContact) => {
    Alert.alert(
      "Marcar promocion usada",
      `Quieres marcar la promocion de ${contact.registration.name} (${contact.phone}) como usada?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Marcar usada",
          style: "destructive",
          onPress: () => {
            void submitUsedPromo(contact);
          },
        },
      ],
    );
  };

  const submitUsedPromo = async (contact: ActivePromoContact) => {
    const promoId = getPromoId(contact);

    if (!APP_CONFIG.waApiKey) {
      Alert.alert(
        "API key no configurada",
        "Configura EXPO_PUBLIC_MOJARRERIA_WA_API_KEY para marcar promociones usadas desde mobile.",
      );
      return;
    }

    setPendingPromoId(promoId);

    try {
      const response = await fetch(
        `${getWaApiBaseUrl()}/messages/registrations/${encodeURIComponent(
          contact.phone,
        )}/use`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "x-api-key": APP_CONFIG.waApiKey,
            "x-client-domain": APP_CONFIG.waClientDomain,
          },
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error ?? "No se pudo marcar la promocion como usada.",
        );
      }

      await loadPromos({ showLoading: false });
    } catch (error) {
      Alert.alert(
        "No se pudo marcar",
        error instanceof Error
          ? error.message
          : "No se pudo marcar la promocion como usada.",
      );
    } finally {
      setPendingPromoId(null);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate(Screens.LandingScreen)}
        >
          <Ionicons name="arrow-back" size={18} color="#334155" />
          <Text style={styles.backButtonText}>Home</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>MOJARRERIA PROMOS</Text>
        <Text style={styles.title}>Active Promotions</Text>
        <Text style={styles.subtitle}>
          Recent WhatsApp contacts with active promo registrations.
        </Text>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Active</Text>
          <Text style={styles.metricValue}>{activeCount}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total</Text>
          <Text style={styles.metricValue}>{contacts.length}</Text>
        </View>
      </View>

      {loadError ? (
        <View style={styles.alertCard}>
          <Text style={styles.alertText}>{loadError}</Text>
        </View>
      ) : null}

      {loadingPromos ? (
        <View style={styles.alertCard}>
          <Text style={styles.alertText}>Loading active promotions...</Text>
        </View>
      ) : null}

      <View style={styles.searchCard}>
        <Text style={styles.inputLabel}>Search by name or phone</Text>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={20} color="#64748b" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="carlos or 5219931175435"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="default"
            style={styles.searchInput}
          />
        </View>
        <Text style={styles.resultCount}>
          Showing {filteredContacts.length} of {contacts.length}
          {search.trim() ? " matching promotions." : " promotions."}
        </Text>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No active promotions</Text>
          <Text style={styles.emptyText}>
            Recent active promo contacts will appear here.
          </Text>
        </View>
      ) : filteredContacts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No matching promotions</Text>
          <Text style={styles.emptyText}>
            Try another name or phone number.
          </Text>
        </View>
      ) : (
        filteredContacts.map((contact) => {
          const promoId = getPromoId(contact);
          const isPending = pendingPromoId === promoId;

          return (
            <View key={promoId} style={styles.promoCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.contactName}>
                    {contact.registration.name}
                  </Text>
                  <Text style={styles.phone}>{contact.phone}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>
                    {contact.registration.status}
                  </Text>
                </View>
              </View>

              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {contact.registration.campaignKey}
                </Text>
              </View>

              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Messages</Text>
                  <Text style={styles.detailValue}>{contact.messageCount}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Last received</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(contact.lastReceivedAt)}
                  </Text>
                </View>
              </View>

              <View style={styles.messageBox}>
                <Text style={styles.messageLabel}>Last WhatsApp message</Text>
                <Text style={styles.messageText}>{contact.lastText}</Text>
                <Text style={styles.messageId}>{contact.lastMessageId}</Text>
              </View>

              <TouchableOpacity
                disabled={isPending}
                onPress={() => {
                  console.log("Marking promo as used for contact:", contact);
                  markAsUsed(contact);
                }}
                style={[
                  styles.markButton,
                  isPending && styles.markButtonDisabled,
                ]}
              >
                {isPending ? (
                  <ActivityIndicator color="#64748b" />
                ) : (
                  <Text
                    style={[
                      styles.markButtonText,
                      isPending && styles.markButtonTextDisabled,
                    ]}
                  >
                    Mark used {contact.registration.name}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 20,
    paddingBottom: 44,
  },
  header: {
    marginBottom: 18,
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#64748b",
    textTransform: "uppercase",
  },
  title: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
  },
  metrics: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  metricValue: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  searchCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 14,
  },
  alertCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 14,
  },
  alertText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#475569",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  searchInputWrap: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#0f172a",
    fontSize: 15,
  },
  resultCount: {
    marginTop: 8,
    fontSize: 12,
    color: "#64748b",
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  promoCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitleWrap: {
    flex: 1,
  },
  contactName: {
    fontSize: 19,
    fontWeight: "700",
    color: "#0f172a",
    textTransform: "capitalize",
  },
  phone: {
    marginTop: 4,
    fontSize: 13,
    color: "#475569",
  },
  statusPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#f8fafc",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    textTransform: "capitalize",
  },
  badge: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#f1f5f9",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  detailGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  detailValue: {
    marginTop: 4,
    fontSize: 13,
    color: "#334155",
  },
  messageBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 12,
  },
  messageLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  messageText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
  },
  messageId: {
    marginTop: 8,
    fontSize: 11,
    color: "#94a3b8",
  },
  markButton: {
    minHeight: 46,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  markButtonDisabled: {
    backgroundColor: "#e2e8f0",
  },
  markButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  markButtonTextDisabled: {
    color: "#64748b",
  },
});
