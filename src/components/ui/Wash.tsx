import { StyleSheet } from 'react-native';

import { useThemeColor, View } from '@/components/Themed';

/**
 * The fixed field behind the glass: a soft vertical gradient (graphite in dark mode, silver in light mode)
 * with a faint light sheen from the top edge, like a lit display. No images, no blobs, no dependency:
 * both layers use React Native's built-in gradient backgrounds. The `wash` color is the solid fallback.
 */
export function Wash() {
  const wash = useThemeColor({}, 'wash');
  const top = useThemeColor({}, 'washTop');
  const mid = useThemeColor({}, 'washMid');
  const bottom = useThemeColor({}, 'washBottom');
  const sheen = useThemeColor({}, 'sheen');

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: wash, experimental_backgroundImage: `linear-gradient(to bottom, ${top}, ${mid} 55%, ${bottom})` }]}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { experimental_backgroundImage: `radial-gradient(ellipse 90% 45% at 50% 0%, ${sheen}, rgba(255, 255, 255, 0))` }]}
      />
    </View>
  );
}
