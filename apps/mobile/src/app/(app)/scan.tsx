import { useCallback, useState } from "react";
import { Linking, View } from "react-native";

import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";

import { api } from "@pioneers/api-client";
import { formatDate } from "@pioneers/core/format";
import type { VerifyResponse } from "@pioneers/core/schemas";

import { Badge, Body, Button, Card, Heading, Muted, Screen, Title } from "@/components/ui";
import { getApiClient } from "@/lib/api";
import { radius, spacing } from "@/theme";
import { useTheme } from "@/theme/use-theme";

/**
 * QR scanner for certificate share links.
 *
 * The QR encodes a /verify/<token> URL. Rather than opening a browser, the
 * token is extracted and resolved through the public API so the result can be
 * shown inside the app — useful when an inspector is checking a client's
 * paperwork on site.
 */
export default function ScanScreen() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restart scanning whenever the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsScanning(true);
        setResult(null);
        setError(null);
      };
    }, []),
  );

  async function handleScan(data: string) {
    if (!isScanning) return;
    setIsScanning(false);
    setError(null);
    setScannedUrl(data);

    const token = extractToken(data);
    if (!token) {
      setError("That QR code is not a Pioneers-EGY certificate link.");
      return;
    }

    try {
      setResult(await api.verify(getApiClient(), token));
    } catch {
      // The public verify endpoint returns 404 for revoked/expired/unknown, and
      // the client throws on non-2xx, so treat any failure as "not valid".
      setResult({ status: "not-found", certificate: null, downloadUrl: null });
    }
  }

  function reset() {
    setResult(null);
    setScannedUrl(null);
    setError(null);
    setIsScanning(true);
  }

  if (!permission) return <Screen />;

  if (!permission.granted) {
    return (
      <Screen>
        <View style={{ padding: spacing.xl, gap: spacing.lg, justifyContent: "center", flex: 1 }}>
          <Title>Scan a certificate</Title>
          <Muted>
            Point the camera at the QR code on a Pioneers-EGY certificate to check that it is
            genuine and still valid.
          </Muted>
          <Button title="Allow camera access" onPress={() => void requestPermission()} />
        </View>
      </Screen>
    );
  }

  if (result || error) {
    return (
      <Screen>
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {error ? (
            <Card style={{ gap: spacing.sm }}>
              <Heading>Not recognised</Heading>
              <Muted>{error}</Muted>
              {scannedUrl ? <Muted>Scanned: {scannedUrl}</Muted> : null}
            </Card>
          ) : result?.status === "ok" && result.certificate ? (
            <Card style={{ gap: spacing.md }}>
              <Badge label="Verified" tone="success" />
              <Title>{result.certificate.title}</Title>

              <View style={{ gap: spacing.xs }}>
                <Row label="Issued to" value={result.certificate.company_name ?? "—"} />
                <Row label="Certificate no." value={result.certificate.certificate_number ?? "—"} />
                <Row label="Issued" value={formatDate(result.certificate.issue_date)} />
                <Row label="Expires" value={formatDate(result.certificate.expiry_date)} />
              </View>

              {result.downloadUrl ? (
                <Button
                  title="Open PDF"
                  onPress={() => void Linking.openURL(result.downloadUrl!)}
                />
              ) : null}
            </Card>
          ) : (
            <Card style={{ gap: spacing.sm }}>
              <Badge
                label={
                  result?.status === "revoked"
                    ? "Revoked"
                    : result?.status === "expired"
                      ? "Link expired"
                      : "Not found"
                }
                tone="danger"
              />
              <Heading>
                {result?.status === "revoked"
                  ? "This link has been revoked"
                  : result?.status === "expired"
                    ? "This link has expired"
                    : "Certificate not found"}
              </Heading>
              <Muted>
                {result?.status === "revoked"
                  ? "Pioneers-EGY has withdrawn access to this certificate."
                  : result?.status === "expired"
                    ? "Ask for a new link to the certificate."
                    : "This QR code does not match any certificate on record."}
              </Muted>
            </Card>
          )}

          <Button title="Scan another" variant="secondary" onPress={reset} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => void handleScan(data)}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
          }}
        >
          <View
            style={{
              width: 240,
              height: 240,
              borderWidth: 3,
              borderColor: "#ffffff",
              borderRadius: radius.lg,
              opacity: 0.9,
            }}
          />
          <Body
            style={{
              color: "#ffffff",
              marginTop: spacing.lg,
              textAlign: "center",
              backgroundColor: "rgba(0,0,0,0.5)",
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
            }}
          >
            Point at a certificate QR code
          </Body>
        </View>
      </CameraView>
      <View style={{ height: 1, backgroundColor: theme.colors.border }} />
    </Screen>
  );
}

/**
 * Pull the token out of a scanned value.
 *
 * Accepts a full https://…/verify/<token> URL (what the QR actually contains)
 * and a bare token, so a manually typed code also works.
 */
function extractToken(value: string): string | null {
  const trimmed = value.trim();

  const match = trimmed.match(/\/verify\/([A-Za-z0-9_-]{32,128})/);
  if (match?.[1]) return match[1];

  if (/^[A-Za-z0-9_-]{32,128}$/.test(trimmed)) return trimmed;

  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
      <Muted>{label}</Muted>
      <Body style={{ flex: 1, textAlign: "right" }}>{value}</Body>
    </View>
  );
}
