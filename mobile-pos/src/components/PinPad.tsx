import { Pressable, Text, View } from "react-native";



type Props = {

  value: string;

  onChange: (next: string) => void;

  onComplete?: (pin: string) => void;

  maxLength?: number;

};



export function PinPad({ value, onChange, onComplete, maxLength = 4 }: Props) {

  function press(digit: string) {

    if (value.length >= maxLength) return;

    const next = value + digit;

    onChange(next);

    if (next.length === maxLength) onComplete?.(next);

  }



  function backspace() {

    onChange(value.slice(0, -1));

  }



  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];



  return (

    <View>

      <View className="mb-6 flex-row justify-center gap-3">

        {Array.from({ length: maxLength }).map((_, i) => (

          <View

            key={i}

            className={`h-4 w-4 rounded-full ${i < value.length ? "bg-indigo-600" : "bg-slate-300"}`}

          />

        ))}

      </View>

      <View className="flex-row flex-wrap justify-center gap-3">

        {keys.map((k, idx) => {

          if (k === "") return <View key={idx} className="h-16 w-16" />;

          const isBack = k === "⌫";

          return (

            <Pressable

              key={idx}

              onPress={() => (isBack ? backspace() : press(k))}

              className="h-16 w-16 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200"

            >

              <Text className="text-2xl font-semibold text-slate-800">{k}</Text>

            </Pressable>

          );

        })}

      </View>

    </View>

  );

}


