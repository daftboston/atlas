import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { languageLabel } from '@/content/sample-lesson';
import { clearProfile, useLearner } from '@/state/learnerStore';
import { DEV_SCRIPT_NAMES, setDevScript, useDevScript } from '@/state/devSpeechScript';

export default function SettingsScreen() {
  const { profile } = useLearner();
  const script = useDevScript();

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
        Listening and speaking use a simulated microphone in this build. App lock is not in this build yet.
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
