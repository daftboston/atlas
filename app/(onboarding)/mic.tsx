import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { createSpeechService } from '@/services/speech/registry';
import { setMicDenied } from '@/state/settingsStore';

export default function MicScreen() {
  const router = useRouter();

  async function allow() {
    const permission = await createSpeechService().requestPermission();
    setMicDenied(permission !== 'granted');
    router.push('/(onboarding)/first-session');
  }

  function skip() {
    setMicDenied(true);
    router.push('/(onboarding)/first-session');
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        Microphone
      </Text>
      <Text style={styles.copy}>
        Atlas listens so it can tell you how close your phrase was. You can type instead, and that still counts.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Allow microphone" onPress={() => void allow()} style={styles.primary}>
        <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
          Allow microphone
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Continue without the microphone" onPress={skip} style={styles.secondary}>
        <Text style={styles.secondaryText}>Continue without the microphone</Text>
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
  secondary: { alignItems: 'center', paddingVertical: 12 },
  secondaryText: { fontSize: 16 },
});
