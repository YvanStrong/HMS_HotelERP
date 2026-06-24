import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import axios from "axios";
import { applyLineDiscount, money, voidLine, type TicketDetail, type TicketLine } from "../api/tickets";
import { PinPad } from "./PinPad";

type Props = {
  visible: boolean;
  line: TicketLine | null;
  ticketId: string;
  hotelId: string;
  onSuccess: (updated: TicketDetail) => void;
  onClose: () => void;
};

type Step = "choose" | "void" | "discount" | "pin";
type PendingAction = "void" | "discount";

const VOID_REASONS = [
  "Wrong item ordered",
  "Customer changed mind",
  "Quality issue",
  "Duplicate entry",
  "Other",
];

const DISCOUNT_REASONS = [...VOID_REASONS, "Loyalty comp"];

function apiPinError(err: unknown): { code?: string; message: string } {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return { code: data?.error, message: data?.message ?? data?.error ?? "Request failed" };
  }
  return { message: err instanceof Error ? err.message : "Request failed" };
}

export function VoidDiscountModal({ visible, line, ticketId, hotelId, onSuccess, onClose }: Props) {
  const [step, setStep] = useState<Step>("choose");
  const [pendingAction, setPendingAction] = useState<PendingAction>("void");
  const [reasonPreset, setReasonPreset] = useState(VOID_REASONS[0]);
  const [reasonOther, setReasonOther] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  const [discountValueText, setDiscountValueText] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinAttempts, setPinAttempts] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStep("choose");
      setPendingAction("void");
      setReasonPreset(VOID_REASONS[0]);
      setReasonOther("");
      setDiscountType("PERCENT");
      setDiscountValueText("");
      setPin("");
      setBusy(false);
      setPinError(null);
      setPinAttempts(0);
    }
  }, [visible]);

  const qty = line ? money(line.quantity) : 0;
  const unitPrice = line ? money(line.unitPrice) : 0;
  const lineTotal = line ? money(line.lineTotal) : 0;

  const discountPreview = useMemo(() => {
    const gross = unitPrice * qty;
    const raw = Number.parseFloat(discountValueText.replace(/,/g, "")) || 0;
    if (discountType === "PERCENT") {
      const pct = Math.min(100, Math.max(0, raw));
      const amount = (gross * pct) / 100;
      return { gross, amount, net: Math.max(0, gross - amount), pct };
    }
    const amount = Math.min(gross, Math.max(0, raw));
    return { gross, amount, net: gross - amount, pct: gross > 0 ? (amount / gross) * 100 : 0 };
  }, [discountType, discountValueText, qty, unitPrice]);

  function resolvedReason(): string {
    if (reasonPreset === "Other") {
      return reasonOther.trim() || "Other";
    }
    return reasonPreset;
  }

  function closeModal() {
    onClose();
  }

  async function submitWithPin(enteredPin: string) {
    if (!line || !hotelId) return;
    const reason = resolvedReason();
    if (!reason.trim()) {
      Toast.show({ type: "error", text1: "Reason required" });
      return;
    }
    setBusy(true);
    setPinError(null);
    try {
      let updated: TicketDetail;
      if (pendingAction === "void") {
        updated = await voidLine(hotelId, ticketId, line.id, {
          reason,
          managerPin: enteredPin,
        });
        Toast.show({ type: "success", text1: "Item voided" });
      } else {
        const value = Number.parseFloat(discountValueText.replace(/,/g, "")) || 0;
        if (value <= 0) {
          Toast.show({ type: "error", text1: "Enter a discount value" });
          return;
        }
        updated = await applyLineDiscount(hotelId, ticketId, line.id, {
          discountType,
          discountValue: value,
          reason,
          managerPin: enteredPin,
        });
        Toast.show({ type: "success", text1: "Discount applied" });
      }
      onSuccess(updated);
      closeModal();
    } catch (err) {
      const { code, message } = apiPinError(err);
      setPin("");
      if (code === "INVALID_PIN") {
        const next = pinAttempts + 1;
        setPinAttempts(next);
        setPinError(`Incorrect PIN. ${Math.max(0, 3 - next)} attempts remaining`);
      } else if (code === "INSUFFICIENT_ROLE") {
        setPinError("This PIN belongs to a staff member. A manager PIN is required.");
      } else {
        setPinError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!line) return null;

  const reasonOptions = pendingAction === "discount" ? DISCOUNT_REASONS : VOID_REASONS;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
      <View className="flex-1 bg-slate-50">
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
          <Text className="text-lg font-bold text-slate-900">
            {step === "choose"
              ? "Modify Item"
              : step === "void"
                ? `Void: ${line.productName}`
                : step === "discount"
                  ? `Discount: ${line.productName}`
                  : "Manager Authorization Required"}
          </Text>
          <Pressable onPress={closeModal}>
            <Text className="font-medium text-indigo-600">Cancel</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 py-4">
          {step === "choose" ? (
            <>
              <View className="mb-4 rounded-2xl bg-white p-4">
                <Text className="text-base font-semibold text-slate-900">{line.productName}</Text>
                <Text className="mt-1 text-slate-600">
                  {qty} × {unitPrice.toFixed(2)} = {lineTotal.toFixed(2)}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setPendingAction("void");
                  setReasonPreset(VOID_REASONS[0]);
                  setStep("void");
                }}
                className="mb-3 rounded-2xl bg-red-600 px-4 py-5"
              >
                <Text className="text-center text-lg font-semibold text-white">Void Item</Text>
                <Text className="mt-1 text-center text-sm text-red-100">Remove entirely from the bill</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setPendingAction("discount");
                  setReasonPreset(DISCOUNT_REASONS[0]);
                  setStep("discount");
                }}
                className="mb-3 rounded-2xl bg-amber-500 px-4 py-5"
              >
                <Text className="text-center text-lg font-semibold text-white">Apply Discount</Text>
                <Text className="mt-1 text-center text-sm text-amber-100">Reduce price on this line</Text>
              </Pressable>
            </>
          ) : null}

          {step === "void" ? (
            <>
              <Text className="mb-3 text-sm text-amber-800">
                This will remove the item from the bill. Kitchen has already been notified if the item was sent.
              </Text>
              <Text className="mb-2 text-sm font-medium text-slate-700">Reason</Text>
              {reasonOptions.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setReasonPreset(r)}
                  className={`mb-2 rounded-xl border px-4 py-3 ${
                    reasonPreset === r ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <Text className="text-slate-800">{r}</Text>
                </Pressable>
              ))}
              {reasonPreset === "Other" ? (
                <TextInput
                  value={reasonOther}
                  onChangeText={setReasonOther}
                  placeholder="Describe reason"
                  className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
                />
              ) : null}
              <Pressable
                onPress={() => setStep("pin")}
                className="mt-2 rounded-xl bg-indigo-600 py-4"
              >
                <Text className="text-center font-semibold text-white">Next: Manager Approval</Text>
              </Pressable>
            </>
          ) : null}

          {step === "discount" ? (
            <>
              <View className="mb-4 flex-row gap-2">
                <Pressable
                  onPress={() => setDiscountType("PERCENT")}
                  className={`flex-1 rounded-xl py-3 ${discountType === "PERCENT" ? "bg-indigo-600" : "bg-slate-200"}`}
                >
                  <Text
                    className={`text-center font-semibold ${discountType === "PERCENT" ? "text-white" : "text-slate-700"}`}
                  >
                    % Percent
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setDiscountType("AMOUNT")}
                  className={`flex-1 rounded-xl py-3 ${discountType === "AMOUNT" ? "bg-indigo-600" : "bg-slate-200"}`}
                >
                  <Text
                    className={`text-center font-semibold ${discountType === "AMOUNT" ? "text-white" : "text-slate-700"}`}
                  >
                    RWF Amount
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={discountValueText}
                onChangeText={setDiscountValueText}
                keyboardType="decimal-pad"
                placeholder={discountType === "PERCENT" ? "e.g. 15" : "e.g. 500"}
                className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg"
              />
              <View className="mb-4 rounded-xl bg-white p-4">
                <Text className="text-slate-600">Original: RWF {discountPreview.gross.toFixed(2)}</Text>
                <Text className="text-amber-700">Discount: - RWF {discountPreview.amount.toFixed(2)}</Text>
                <Text className="mt-2 text-lg font-bold text-indigo-600">
                  New total: RWF {discountPreview.net.toFixed(2)}
                </Text>
              </View>
              <Text className="mb-2 text-sm font-medium text-slate-700">Reason</Text>
              {reasonOptions.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setReasonPreset(r)}
                  className={`mb-2 rounded-xl border px-4 py-3 ${
                    reasonPreset === r ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <Text className="text-slate-800">{r}</Text>
                </Pressable>
              ))}
              {reasonPreset === "Other" ? (
                <TextInput
                  value={reasonOther}
                  onChangeText={setReasonOther}
                  placeholder="Describe reason"
                  className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
                />
              ) : null}
              <Pressable
                onPress={() => setStep("pin")}
                className="mt-2 rounded-xl bg-indigo-600 py-4"
              >
                <Text className="text-center font-semibold text-white">Next: Manager Approval</Text>
              </Pressable>
            </>
          ) : null}

          {step === "pin" ? (
            <>
              <Text className="mb-1 text-center text-slate-600">A manager must enter their PIN to authorize</Text>
              <View className="mt-4">
                <PinPad value={pin} onChange={setPin} onComplete={(p) => void submitWithPin(p)} />
              </View>
              {pinError ? (
                <Text className="mt-4 text-center text-sm text-red-600">{pinError}</Text>
              ) : null}
              <Pressable
                onPress={() => setStep(pendingAction === "void" ? "void" : "discount")}
                className="mt-6 py-2"
              >
                <Text className="text-center text-slate-500">← Back</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>

        {busy ? (
          <View className="absolute inset-0 items-center justify-center bg-black/20">
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
