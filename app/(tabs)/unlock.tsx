import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import type { UnlockGrantRow } from '@/data/repositories/unlockRepo';
import { activateGrant, refreshUnlock, useUnlock } from '@/state/unlockStore';

function remainingLabel(expiresAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')} left`;
}

function Grant({ grant, now }: { grant: UnlockGrantRow; now: number }) {
  if (grant.status === 'active' && grant.expiresAt !== null) {
    return (
      <View style={styles.card}>
        <Text style={styles.word}>{grant.minutes} minutes</Text>
        <Text style={styles.meta}>{remainingLabel(grant.expiresAt, now)}</Text>
      </View>
    );
  }
  if (grant.status === 'earned') {
    return (
      <View style={styles.card}>
        <Text style={styles.word}>{grant.minutes} minutes</Text>
        <Text style={styles.meta}>Earned</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Activate" onPress={() => void activateGrant(grant.id)} style={styles.primary}>
          <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
            Activate
          </Text>
        </Pressable>
      </View>
    );
  }
  if (grant.status === 'expired') {
    return (
      <View style={styles.card}>
        <Text style={styles.word}>{grant.minutes} minutes</Text>
        <Text style={styles.meta}>Expired</Text>
      </View>
    );
  }
  return null;
}

export default function UnlockScreen() {
  const unlock = useUnlock();

  useEffect(() => {
    void refreshUnlock();
    const timer = setInterval(() => void refreshUnlock(), 1000);
    return () => clearInterval(timer);
  }, []);

  const visible = unlock.grants.filter((grant) => grant.status !== 'forfeited');
  const status =
    unlock.availability === 'authorized'
      ? 'Screen Time is simulated as on.'
      : 'Screen Time is unavailable. This timer still runs.';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unlock</Text>
      <Text style={styles.copy}>{status}</Text>
      {visible.length === 0 ? <Text style={styles.copy}>No unlocks yet. Finish a practice session to earn one.</Text> : null}
      {visible.map((grant) => (
        <Grant key={grant.id} grant={grant} now={unlock.now} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  copy: { fontSize: 16, lineHeight: 22 },
  card: { gap: 6, paddingVertical: 8 },
  word: { fontSize: 22, fontWeight: '600' },
  meta: { fontSize: 15, opacity: 0.75 },
  primary: { backgroundColor: '#2f95dc', borderRadius: 8, alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  primaryText: { fontSize: 17, fontWeight: '600' },
});
