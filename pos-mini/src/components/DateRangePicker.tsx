import { Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import type { DateRangePreset, ReportDateRange } from '../utils/reports';
import { getCustomRange, getPresetRange } from '../utils/reports';
import { colors, primaryButtonStyle, selectedChipStyle, unselectedChipStyle } from '../constants/theme';

type Props = {
  range: ReportDateRange;
  onChange: (range: ReportDateRange) => void;
};

const PRESETS: { key: Exclude<DateRangePreset, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

function chipStyle(selected: boolean) {
  return selected ? selectedChipStyle : unselectedChipStyle;
}

export function DateRangePicker({ range, onChange }: Props) {
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [customStart, setCustomStart] = useState(new Date(range.startIso));
  const [customEnd, setCustomEnd] = useState(new Date(range.endIso));

  const selectPreset = (preset: Exclude<DateRangePreset, 'custom'>) => {
    onChange(getPresetRange(preset));
  };

  const applyCustom = () => {
    onChange(getCustomRange(customStart, customEnd));
  };

  return (
    <View className="mb-4">
      <View className="flex-row flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => selectPreset(p.key)}
            className="rounded-lg border px-3 py-2"
            style={chipStyle(range.preset === p.key)}
          >
            <Text className="font-semibold text-app-text">{p.label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => onChange(getCustomRange(customStart, customEnd))}
          className="rounded-lg border px-3 py-2"
          style={chipStyle(range.preset === 'custom')}
        >
          <Text className="font-semibold text-app-text">Custom</Text>
        </Pressable>
      </View>

      {range.preset === 'custom' ? (
        <View className="mt-3 gap-2">
          <Pressable
            onPress={() => setShowStart(true)}
            className="rounded-lg border border-app-border bg-app-surface px-3 py-2"
          >
            <Text className="text-app-text">From: {customStart.toLocaleDateString()}</Text>
          </Pressable>
          {showStart ? (
            <DateTimePicker
              value={customStart}
              mode="date"
              onChange={(_, date) => {
                setShowStart(false);
                if (date) {
                  setCustomStart(date);
                  onChange(getCustomRange(date, customEnd));
                }
              }}
            />
          ) : null}
          <Pressable
            onPress={() => setShowEnd(true)}
            className="rounded-lg border border-app-border bg-app-surface px-3 py-2"
          >
            <Text className="text-app-text">To: {customEnd.toLocaleDateString()}</Text>
          </Pressable>
          {showEnd ? (
            <DateTimePicker
              value={customEnd}
              mode="date"
              onChange={(_, date) => {
                setShowEnd(false);
                if (date) {
                  setCustomEnd(date);
                  onChange(getCustomRange(customStart, date));
                }
              }}
            />
          ) : null}
          <Pressable onPress={applyCustom} className="rounded-xl py-2" style={primaryButtonStyle}>
            <Text className="text-center font-semibold text-white">Apply range</Text>
          </Pressable>
        </View>
      ) : null}

      <Text className="mt-2 text-xs text-app-muted">
        {new Date(range.startIso).toLocaleDateString()} –{' '}
        {new Date(range.endIso).toLocaleDateString()}
      </Text>
    </View>
  );
}
