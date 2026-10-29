import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';

import { useThemeColor, View } from '@/components/Themed';
import type { DemoApp } from '@/domain/blocking/apps';

/** A simple rounded-square icon. It is decorative, so screen readers skip it and read the app name instead. */
export function AppIcon({ app, size = 40 }: { app: DemoApp; size?: number }) {
  const fill = useThemeColor({}, 'fill');
  const tint = useThemeColor({}, 'tint');
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.icon, { width: size, height: size, borderRadius: size * 0.24, backgroundColor: fill }]}>
      <SymbolView name={app.symbol as never} tintColor={tint} size={size * 0.5} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
