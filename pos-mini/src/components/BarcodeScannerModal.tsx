import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

/** Uses expo-camera (SDK 54) — equivalent to expo-barcode-scanner for barcode detection. */

type Props = {
  visible: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
};

export function BarcodeScannerModal({ visible, onClose, onScan }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const lastScan = useRef<string | null>(null);
  const [scanning, setScanning] = useState(true);

  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      if (!scanning || !data) return;
      if (lastScan.current === data) return;
      lastScan.current = data;
      setScanning(false);
      onScan(data);
      onClose();
    },
    [onClose, onScan, scanning],
  );

  const handleClose = () => {
    lastScan.current = null;
    setScanning(true);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-black">
        {!permission ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-white">Checking camera permission...</Text>
          </View>
        ) : !permission.granted ? (
          <View className="flex-1 items-center justify-center bg-gray-100 px-6">
            <Text className="mb-4 text-center text-lg font-bold text-app-text">
              Camera access is required to scan barcodes.
            </Text>
            <Pressable onPress={() => void requestPermission()} className="mb-3 border-2 border-app-border bg-app-primary px-6 py-3">
              <Text className="font-bold text-white">Grant Permission</Text>
            </Pressable>
            <Pressable onPress={handleClose} className="border-2 border-app-border bg-app-surface px-6 py-3">
              <Text className="font-bold text-app-text">Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
              }}
              onBarcodeScanned={scanning ? handleBarcode : undefined}
            />
            <View className="absolute bottom-0 left-0 right-0 border-t-2 border-app-border bg-app-surface p-4">
              <Text className="mb-3 text-center font-bold text-app-text">Point camera at barcode</Text>
              <Pressable onPress={handleClose} className="border-2 border-app-border bg-app-surface py-3">
                <Text className="text-center font-bold text-app-text">Close</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
