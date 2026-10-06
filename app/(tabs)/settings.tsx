import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { LANGUAGES } from '@/content/sample-lesson';
import { clearProfile, useLearner } from '@/lib/learner-store';

function label(id: string) {
  return LANGUAGES.find((language) => language.id === id)?.label ?? id;
}

export default function SettingsScreen() {
  const { profile } = useLearner();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      {profile ? (
        <Text style={styles.copy}>
          Learning {label(profile.targetLanguage)} from {label(profile.nativeLanguage)}.
        </Text>
      ) : (
        <Text style={styles.copy}>No language chosen yet.</Text>
      )}
      <Text style={styles.copy}>Listening, speaking, and app lock are not in this build yet.</Text>
      {profile ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Choose language again" onPress={clearProfile} style={styles.button}>
          <Text style={styles.buttonText}>Choose language again</Text>
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
