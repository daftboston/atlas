import { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Text, useThemeColor, View } from '@/components/Themed';
import { Group, PrimaryButton, ScreenTitle, SectionFooter, SectionHeader } from '@/components/ui/ios';
import type { UnlockGrantRow } from '@/data/repositories/unlockRepo';
import { activateGrant, refreshUnlock, useUnlock } from '@/state/unlockStore';

function remainingLabel(expiresAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')} left`;
}

function Grant({ grant, now }: { grant: UnlockGrantRow; now: number }) {
  const secondary = useThemeColor({}, 'secondaryText');
  return (
    <View style={styles.grant}>
      <Text style={styles.minutes}>{grant.minutes} minutes</Text>
      {grant.status === 'active' && grant.expiresAt !== null ? (
        <Text style={[styles.meta, { color: secondary }]}>{remainingLabel(grant.expiresAt, now)}</Text>
      ) : null}
      {grant.status === 'earned' ? <Text style={[styles.meta, { color: secondary }]}>Earned</Text> : null}
      {grant.status === 'expired' ? <Text style={[styles.meta, { color: secondary }]}>Expired</Text> : null}
      {grant.status === 'earned' ? (
        <View style={styles.activate}>
          <PrimaryButton label="Activate" onPress={() => void activateGrant(grant.id)} />
        </View>
      ) : null}
    </View>
  );
}

export default function UnlockScreen() {
  const unlock = useUnlock();
  const secondary = useThemeColor({}, 'secondaryText');

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
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <ScreenTitle>Unlock</ScreenTitle>
      <SectionHeader>Today</SectionHeader>
      <Group>
        <View style={styles.status}>
          <Text style={styles.copy}>{status}</Text>
        </View>
      </Group>
      <SectionFooter>
        A finished session earns free minutes. Activate starts the countdown. Blocking other apps comes later, on a physical iPhone.
      </SectionFooter>
      {visible.length === 0 ? (
        <Text style={[styles.copy, styles.empty, { color: secondary }]}>No unlocks yet. Finish a practice session to earn one.</Text>
      ) : (
        <Group>
          {visible.map((grant) => (
            <Grant key={grant.id} grant={grant} now={unlock.now} />
          ))}
        </Group>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: 128 },
  status: { paddingHorizontal: 16, paddingVertical: 12 },
  copy: { fontSize: 17, lineHeight: 22 },
  empty: { marginTop: 16 },
  grant: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  minutes: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  meta: { fontSize: 15, fontVariant: ['tabular-nums'] },
  activate: { marginTop: 8 },
});