import { useEffect, useState } from "react";

import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";

import Toast from "react-native-toast-message";

import type { TicketDetail } from "../api/tickets";

import { getPrinter } from "../printing/PrinterConfig";

import {

  connectPrinterForRole,

  isPrinterModuleAvailable,

  printReceipt,

  scanForPrinters,

  type PrinterDevice,

} from "../printing/PrinterService";



type Props = {

  visible: boolean;

  ticket: TicketDetail | null;

  hotelName: string;

  onClose: () => void;

  onSkip: () => void;

};



export function PrinterModal({ visible, ticket, hotelName, onClose, onSkip }: Props) {

  const [busy, setBusy] = useState(false);

  const [scanning, setScanning] = useState(false);

  const [devices, setDevices] = useState<PrinterDevice[]>([]);

  const connected = getPrinter("receipt");



  useEffect(() => {

    if (!visible) return;

    setDevices([]);

  }, [visible]);



  async function handleScan() {

    if (!isPrinterModuleAvailable()) {

      Toast.show({

        type: "info",

        text1: "Dev build required",

        text2: "Bluetooth printing needs a native build, not Expo Go",

      });

      return;

    }

    setScanning(true);

    try {

      setDevices(await scanForPrinters());

    } catch (err) {

      Toast.show({ type: "error", text1: "Scan failed", text2: String(err) });

    } finally {

      setScanning(false);

    }

  }



  async function handlePrint() {

    if (!ticket) return;

    setBusy(true);

    try {

      await printReceipt(ticket, hotelName);

      Toast.show({ type: "success", text1: "Receipt printed" });

      onClose();

    } catch (err) {

      Toast.show({ type: "error", text1: "Print failed", text2: String(err) });

    } finally {

      setBusy(false);

    }

  }



  return (

    <Modal visible={visible} transparent animationType="fade">

      <View className="flex-1 items-center justify-center bg-black/40 px-6">

        <View className="w-full max-w-md rounded-2xl bg-white p-5">

          <Text className="text-lg font-bold text-slate-900">Print receipt?</Text>

          <Text className="mt-1 text-sm text-slate-500">Optional — payment is already complete.</Text>



          {connected ? (

            <Text className="mt-3 text-xs text-emerald-700">Printer: {connected.name}</Text>

          ) : (

            <Text className="mt-3 text-xs text-amber-700">No printer connected</Text>

          )}



          {!connected ? (

            <Pressable onPress={() => void handleScan()} className="mt-3 rounded-xl border border-slate-300 py-3">

              <Text className="text-center font-medium text-slate-700">

                {scanning ? "Scanning…" : "Connect printer"}

              </Text>

            </Pressable>

          ) : null}



          {devices.length > 0 ? (

            <ScrollView className="mt-2 max-h-32">

              {devices.map((d) => (

                <Pressable

                  key={d.address}

                  className="mb-1 rounded-lg bg-slate-100 px-3 py-2"

                  onPress={() => {

                    void (async () => {

                      setBusy(true);

                      try {

                        await connectPrinterForRole("receipt", d);

                        Toast.show({ type: "success", text1: "Printer connected", text2: d.name });

                      } catch (err) {

                        Toast.show({ type: "error", text1: "Connect failed", text2: String(err) });

                      } finally {

                        setBusy(false);

                      }

                    })();

                  }}

                >

                  <Text className="text-sm font-medium">{d.name}</Text>

                  <Text className="text-xs text-slate-500">{d.address}</Text>

                </Pressable>

              ))}

            </ScrollView>

          ) : null}



          <Pressable

            disabled={busy || !connected || !ticket}

            onPress={() => void handlePrint()}

            className={`mt-4 rounded-xl py-3 ${connected ? "bg-indigo-600" : "bg-slate-300"}`}

          >

            <Text className="text-center font-semibold text-white">Print receipt</Text>

          </Pressable>



          <Pressable onPress={onSkip} className="mt-2 rounded-xl py-3">

            <Text className="text-center font-medium text-slate-600">Skip</Text>

          </Pressable>



          {busy ? (

            <View className="absolute inset-0 items-center justify-center rounded-2xl bg-white/70">

              <ActivityIndicator color="#4f46e5" />

            </View>

          ) : null}

        </View>

      </View>

    </Modal>

  );

}


