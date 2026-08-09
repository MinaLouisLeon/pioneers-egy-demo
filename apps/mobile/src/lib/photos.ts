import { Directory, File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import { newClientId } from "@pioneers/core/ids";

export type CapturedPhoto = {
  uri: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

/**
 * Directory for photos awaiting upload.
 *
 * The camera and picker return URIs in a cache directory the OS is free to
 * purge at any moment. A queued photo may sit on the device for hours before
 * there is signal, so every capture is copied somewhere durable first.
 */
export function getPhotoDirectory(): Directory {
  return new Directory(Paths.document, "pending-photos");
}

function ensureDirectory(): Directory {
  const directory = getPhotoDirectory();
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

/**
 * Resize and re-encode before storing.
 *
 * A modern phone camera produces 4–12 MB frames. An inspection photo needs to
 * show a defect, not print at A3, and the upload happens over whatever signal a
 * refinery has — so 1600px on the long edge at 80% JPEG is the right trade.
 */
async function processImage(uri: string): Promise<CapturedPhoto> {
  const directory = ensureDirectory();

  const manipulated = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const fileName = `${newClientId()}.jpg`;

  const source = new File(manipulated.uri);
  const destination = new File(directory, fileName);

  await source.move(destination);

  return {
    uri: destination.uri,
    fileName,
    contentType: "image/jpeg",
    sizeBytes: destination.size ?? 0,
  };
}

export async function capturePhoto(): Promise<CapturedPhoto[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    Alert.alert(
      "Camera access needed",
      "Enable camera access for Pioneers-EGY in your device settings to photograph inspection findings.",
    );
    return [];
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
    // Editing adds a step in the field for no inspection value.
    allowsEditing: false,
  });

  if (result.canceled || !result.assets[0]) return [];

  return [await processImage(result.assets[0].uri)];
}

export async function pickPhotos(limit: number): Promise<CapturedPhoto[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert(
      "Photo access needed",
      "Enable photo access for Pioneers-EGY in your device settings to attach existing images.",
    );
    return [];
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, limit),
    quality: 1,
  });

  if (result.canceled) return [];

  const processed: CapturedPhoto[] = [];
  for (const asset of result.assets.slice(0, limit)) {
    processed.push(await processImage(asset.uri));
  }
  return processed;
}
