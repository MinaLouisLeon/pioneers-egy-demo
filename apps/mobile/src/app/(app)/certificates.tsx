import { useCallback, useState } from "react";
import { FlatList, Linking, RefreshControl, View } from "react-native";

import { useFocusEffect } from "expo-router";

import { api } from "@pioneers/api-client";
import {
  CERTIFICATE_STATUS_LABELS,
  certificateStatus,
  formatDate,
  formatBytes,
} from "@pioneers/core";

import { Badge, Body, Button, Card, EmptyState, Input, Muted, Screen } from "@/components/ui";
import { getApiClient } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { spacing } from "@/theme";
import { useTheme } from "@/theme/use-theme";

type Certificate = {
  id: string;
  title: string;
  file_name: string;
  r2_key: string;
  size_bytes: number;
  company_name: string | null;
  certificate_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
};

/**
 * Certificate register.
 *
 * Unlike jobs, this reads from Supabase directly rather than the local mirror:
 * the register is a shared, mostly-read dataset that is not edited in the
 * field, so caching it offline would add sync complexity for no real benefit.
 * Offline, the list simply shows what it last loaded.
 */
export default function CertificatesScreen() {
  const theme = useTheme();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("certificates")
      .select(
        "id, title, file_name, r2_key, size_bytes, company_name, certificate_number, issue_date, expiry_date",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);

    if (queryError) {
      setError("Could not load certificates. Check your connection.");
    } else {
      setError(null);
      setCertificates(data ?? []);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const query = search.trim().toLowerCase();
  const filtered = certificates.filter(
    (certificate) =>
      !query ||
      certificate.title.toLowerCase().includes(query) ||
      certificate.file_name.toLowerCase().includes(query) ||
      (certificate.company_name ?? "").toLowerCase().includes(query) ||
      (certificate.certificate_number ?? "").toLowerCase().includes(query),
  );

  async function download(certificate: Certificate) {
    try {
      const { urls } = await api.storage.downloadUrls(getApiClient(), {
        keys: [certificate.r2_key],
        download: true,
      });

      const url = urls[certificate.r2_key];
      if (url) await Linking.openURL(url);
    } catch {
      setError("Could not open that certificate.");
    }
  }

  return (
    <Screen>
      <View style={{ padding: spacing.lg }}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search by file name, title or company…"
          autoCorrect={false}
        />
      </View>

      {error ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <Muted style={{ color: theme.colors.danger }}>{error}</Muted>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(certificate) => certificate.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void load();
            }}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              title={search ? "No matching certificates" : "No certificates yet"}
              description={
                search
                  ? "Try a different search term."
                  : "Certificates uploaded from the web app appear here."
              }
            />
          )
        }
        renderItem={({ item }) => {
          const status = certificateStatus(item.expiry_date);
          return (
            <Card style={{ gap: spacing.sm }}>
              <View style={{ gap: 2 }}>
                <Body style={{ fontWeight: "600" }}>{item.title}</Body>
                <Muted>
                  {item.file_name} · {formatBytes(item.size_bytes)}
                </Muted>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  flexWrap: "wrap",
                }}
              >
                <Badge
                  label={CERTIFICATE_STATUS_LABELS[status]}
                  tone={
                    status === "expired"
                      ? "danger"
                      : status === "expiring"
                        ? "warning"
                        : status === "valid"
                          ? "success"
                          : "neutral"
                  }
                />
                {item.company_name ? <Muted>{item.company_name}</Muted> : null}
              </View>

              <Muted>
                Issued {formatDate(item.issue_date)} · Expires {formatDate(item.expiry_date)}
              </Muted>

              <Button title="Download" variant="secondary" onPress={() => void download(item)} />
            </Card>
          );
        }}
      />
    </Screen>
  );
}
