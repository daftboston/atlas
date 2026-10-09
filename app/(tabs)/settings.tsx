import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { languageLabel } from '@/content/sample-lesson';
import { setScreenTimeSimulation } from '@/services/screenTime/stub';
import { DEV_SCRIPT_NAMES, setDevScript, useDevScript } from '@/state/devSpeechScript';
import { clearProfile, useLearner } from '@/state/learnerStore';

export default function SettingsScreen() {
  const { profile } = useLearner();
  const script = useDevScript();
  const [screenTimeOn, setScreenTimeOn] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      {profile ? (
        <Text style={styles.copy}>
          Learning {languageLabel(profile.targetLanguage)} from {languageLabel(profile.nativeLanguage)}.
        </Text>
      ) : (
        <Text style={styles.copy}>Course not started yet.</Text>
      )}
      <Text style={styles.copy}>Atlas starts with English to Spanish. More languages are coming later.</Text>
      <Text style={styles.copy}>
        Listening and speaking use a simulated microphone in this build. Screen Time is not connected, so an unlock is a timer on this phone.
      </Text>
      {__DEV__ ? (
        <View style={styles.scripts}>
          <Text style={styles.copy}>Simulated answer for the next Repeat.</Text>
          {DEV_SCRIPT_NAMES.map((name) => {
            const selected = script === name;
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel={`Simulated answer, ${name}`}
                accessibilityState={{ selected }}
                onPress={() => setDevScript(name)}
                style={[styles.button, selected && styles.buttonSelected]}>
                <Text style={styles.buttonText}>{name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {__DEV__ ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Simulate Screen Time"
          accessibilityState={{ selected: screenTimeOn }}
          onPress={() => {
            const next = !screenTimeOn;
            setScreenTimeOn(next);
            setScreenTimeSimulation(next);
          }}
          style={[styles.button, screenTimeOn && styles.buttonSelected]}>
          <Text style={styles.buttonText}>{screenTimeOn ? 'Screen Time simulation on' : 'Simulate Screen Time'}</Text>
        </Pressable>
      ) : null}
      {profile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show course setup again"
          onPress={clearProfile}
          style={styles.button}>
          <Text style={styles.buttonText}>Show course setup again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
  },
  scripts: {
    gap: 8,
  },
  buttonSelected: {
    borderColor: '#2f95dc',
  },
  button: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
