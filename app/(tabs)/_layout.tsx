import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { GlassSurface } from '@/components/ui/Glass';
import Colors from '@/constants/Colors';

// Tab bar from architecture §3: Learn, Review, Unlock, Settings.
export default function TabLayout() {
  const colorScheme = useColorScheme();

  const palette = Colors[colorScheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.tint,
        tabBarInactiveTintColor: palette.tabIconDefault,
        // The screen draws its own large title. A second bar would repeat it.
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <GlassSurface
            glassEffectStyle="clear"
            tintColor={palette.glass}
            fallbackColor={palette.card}
            style={StyleSheet.absoluteFill}
          />
        ),
      }}>
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'book', android: 'book', web: 'book' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: 'Review',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'arrow.counterclockwise', android: 'replay', web: 'replay' }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="unlock"
        options={{
          title: 'Unlock',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'lock.open', android: 'lock_open', web: 'lock_open' }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} tintColor={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
});
