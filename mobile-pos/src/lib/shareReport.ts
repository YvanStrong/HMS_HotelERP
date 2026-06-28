import { Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export async function sharePlainText(title: string, content: string): Promise<void> {
  await Share.share({ title, message: content });
}

export async function shareCsvFile(filename: string, csv: string): Promise<void> {
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: "Export report" });
    return;
  }
  await Share.share({ message: csv, title: filename });
}
