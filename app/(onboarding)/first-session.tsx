import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { startOnboardingSession } from '@/state/sessionStore';

export default function FirstSessionScreen() {
  const router = useRouter();
  const [empty, setEmpty] = useState(false);

  function start() {
    const result = startOnboardingSession();
    if (result.kind === 'caught-up') {
      setEmpty(true);
      return;
    }
    router.push({ pathname: '/practice/[sessionId]', params: { sessionId: result.id } });
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        First session
      </Text>
      <Text style={styles.copy}>Three new phrases. Listen, then say each one back. Typing works too.</Text>
      {empty ? <Text style={styles.copy}>Nothing new is waiting right now.</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Start first session" onPress={start} style={styles.primary}>
        <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
          Start first session
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
