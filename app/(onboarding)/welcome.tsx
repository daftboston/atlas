import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        Welcome
      </Text>
      <Text style={styles.copy}>Atlas gets you speaking from the first minute, in short daily sessions.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next" onPress={() => router.push('/(onboarding)/language')} style={styles.primary}>
        <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
          Next
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700' },
  copy: { fontSize: 18, lineHeight: 26 },
  primary: { backgroundColor: '#2f95dc', borderRadius: 8, alignItems: 'center', paddingVertical: 14 },
  primaryText: { fontSize: 17, fontWeight: '600' },
});
