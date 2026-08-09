import { useCallback, useState } from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";

import { useFocusEffect } from "expo-router";

import { api, type AdminUser } from "@pioneers/api-client";
import { formatRelative } from "@pioneers/core/format";
import { ROLE_LABELS, USER_ROLES, can, type UserRole } from "@pioneers/core/roles";

import { Badge, Body, Button, Card, EmptyState, Input, Muted, Screen } from "@/components/ui";
import { getApiClient } from "@/lib/api";
import { useSession } from "@/lib/session";
import { spacing } from "@/theme";
import { useTheme } from "@/theme/use-theme";

/**
 * Account management, admin only.
 *
 * Goes through the same /api/admin/* routes the web app uses (authenticated
 * with a bearer token rather than a cookie), so the service-role key never
 * comes near the device.
 */
export default function AccountsScreen() {
  const theme = useTheme();
  const { profile } = useSession();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = can(profile?.role, "accounts.manage");

  const load = useCallback(async () => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    try {
      const { users: loaded } = await api.admin.listUsers(getApiClient());
      setUsers(loaded);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load accounts.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Defence in depth: the tab is hidden for non-admins, the screen refuses to
  // render, and the API rejects the request regardless.
  if (!isAdmin) {
    return (
      <Screen>
        <EmptyState
          title="Administrators only"
          description="Account management is restricted to administrators."
        />
      </Screen>
    );
  }

  function changeRole(user: AdminUser) {
    Alert.alert(`Change role for ${user.full_name}`, "Choose the new role.", [
      ...USER_ROLES.map((role) => ({
        text: ROLE_LABELS[role],
        onPress: async () => {
          try {
            const { user: updated } = await api.admin.updateUser(getApiClient(), user.id, { role });
            setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
          } catch (caught) {
            Alert.alert(
              "Could not update",
              caught instanceof Error ? caught.message : "Unexpected error.",
            );
          }
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  async function toggleActive(user: AdminUser) {
    try {
      const { user: updated } = await api.admin.updateUser(getApiClient(), user.id, {
        is_active: !user.is_active,
      });
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (caught) {
      Alert.alert(
        "Could not update",
        caught instanceof Error ? caught.message : "Unexpected error.",
      );
    }
  }

  const query = search.trim().toLowerCase();
  const filtered = users.filter(
    (user) =>
      !query ||
      user.full_name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query),
  );

  return (
    <Screen>
      <View style={{ padding: spacing.lg }}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email…"
          autoCapitalize="none"
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
        keyExtractor={(user) => user.id}
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
              title={search ? "No matching accounts" : "No accounts"}
              description="Invite colleagues from the web app."
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={{ gap: spacing.sm }}>
            <View style={{ gap: 2 }}>
              <Body style={{ fontWeight: "600" }}>
                {item.full_name}
                {item.id === profile?.id ? "  (you)" : ""}
              </Body>
              <Muted>{item.email}</Muted>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
              <Badge label={ROLE_LABELS[item.role as UserRole]} tone="primary" />
              <Badge
                label={
                  !item.is_active ? "Inactive" : item.invite_pending ? "Invite pending" : "Active"
                }
                tone={!item.is_active ? "danger" : item.invite_pending ? "warning" : "success"}
              />
            </View>

            <Muted>
              Last sign-in: {item.last_sign_in_at ? formatRelative(item.last_sign_in_at) : "Never"}
            </Muted>

            {item.id !== profile?.id ? (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Change role"
                    variant="secondary"
                    onPress={() => changeRole(item)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={item.is_active ? "Deactivate" : "Activate"}
                    variant={item.is_active ? "danger" : "secondary"}
                    onPress={() => void toggleActive(item)}
                  />
                </View>
              </View>
            ) : null}
          </Card>
        )}
      />
    </Screen>
  );
}
