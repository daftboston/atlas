import { StyleSheet } from 'react-native';

import { useThemeColor, View } from '@/components/Themed';

/** Fixed color field behind the glass. Orbs stay put while the page scrolls. */
export function Wash() {
  const wash = useThemeColor({}, 'wash');
  const tide = useThemeColor({}, 'orbTide');
  const sand = useThemeColor({}, 'orbSand');
  const coral = useThemeColor({}, 'orbCoral');
  const dusk = useThemeColor({}, 'orbDusk');

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: wash }]}>
      <View pointerEvents="none" style={[styles.orb, styles.sand, { backgroundColor: sand }]} />
      <View pointerEvents="none" style={[styles.orb, styles.coral, { backgroundColor: coral }]} />
      <View pointerEvents="none" style={[styles.orb, styles.tide, { backgroundColor: tide }]} />
      <View pointerEvents="none" style={[styles.orb, styles.dusk, { backgroundColor: dusk }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  sand: { width: 340, height: 340, top: -90, left: -110 },
  coral: { width: 420, height: 420, top: -80, right: -160 },
  tide: { width: 380, height: 380, top: 260, left: -140 },
  dusk: { width: 460, height: 460, bottom: -160, right: -120 },
});
