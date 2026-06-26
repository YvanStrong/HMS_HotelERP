import fs from 'fs';
import path from 'path';

const formFiles = [
  'app/(main)/products/[productId].tsx',
  'app/(main)/products/categories.tsx',
  'app/(main)/settings/business.tsx',
  'app/(main)/settings/security.tsx',
  'app/(main)/settings/discounts.tsx',
  'app/(main)/settings/backup.tsx',
  'app/(main)/settings/printer.tsx',
  'app/(main)/purchases/new.tsx',
  'app/(main)/refunds/new.tsx',
  'app/(main)/stock/adjustments.tsx',
  'app/(auth)/pin.tsx',
];

const keyboardImport =
  "import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';\n";
const keyboardImportAuth =
  "import { KeyboardFormScroll } from '../../src/components/KeyboardFormScroll';\n";

for (const rel of formFiles) {
  const file = path.join('.', rel);
  if (!fs.existsSync(file)) {
    console.log('skip', rel);
    continue;
  }
  let s = fs.readFileSync(file, 'utf8');
  const o = s;

  if (!s.includes('KeyboardFormScroll')) {
    if (rel.startsWith('app/(auth)/')) {
      s = s.replace(/import Toast from 'react-native-toast-message';\n/, (m) => m + keyboardImportAuth);
    } else {
      s = s.replace(/import Toast from 'react-native-toast-message';\n/, (m) => m + keyboardImport);
    }
  }

  s = s.replace(
    /<SafeAreaView className="flex-1 bg-app-bg" edges=\{\['bottom'\]\}>\s*<ScrollView[^>]*>/g,
    '<KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>',
  );
  s = s.replace(
    /<SafeAreaView className="flex-1 bg-gray-100" edges=\{\['bottom'\]\}>\s*<ScrollView[^>]*>/g,
    '<KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>',
  );
  s = s.replace(
    /<SafeAreaView className="flex-1 bg-app-bg" edges=\{\['bottom'\]\}>\s*<ScrollView className="flex-1 px-4 pt-4"[^>]*>/g,
    '<KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>',
  );
  s = s.replace(/<\/ScrollView>\s*<\/SafeAreaView>/g, '</KeyboardFormScroll>');

  if (s !== o) {
    fs.writeFileSync(file, s);
    console.log('updated', rel);
  }
}
