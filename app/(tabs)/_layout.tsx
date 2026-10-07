import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

// Tab bar from architecture §3: Learn, Review, Unlock, Settings.
export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: useClientOnlyValue(false, true),
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
