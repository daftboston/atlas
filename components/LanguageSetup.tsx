import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { LANGUAGES, type LanguageId } from '@/content/sample-lesson';
import { setProfile } from '@/lib/learner-store';

export function LanguageSetup() {
  const [nativeLanguage, setNativeLanguage] = useState<LanguageId | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<LanguageId | null>(null);
  const ready = nativeLanguage !== null && targetLanguage !== null && nativeLanguage !== targetLanguage;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose a language</Text>
      <Text style={styles.copy}>Atlas starts with one language. This first lesson is a sample.</Text>

      <Text style={styles.label}>I speak</Text>
      <View style={styles.choices}>
        {LANGUAGES.filter((language) => language.id !== 'pt').map((language) => (
          <Choice
            key={language.id}
            label={language.label}
            accessibilityLabel={`Native language, ${language.label}`}
            selected={nativeLanguage === language.id}
            onPress={() => {
              setNativeLanguage(language.id);
              if (targetLanguage === language.id) setTargetLanguage(null);
            }}
          />
        ))}
      </View>

      <Text style={styles.label}>I want to learn</Text>
      <View style={styles.choices}>
        {LANGUAGES.filter((language) => language.id !== nativeLanguage).map((language) => (
          <Choice
            key={language.id}
            label={language.label}
            accessibilityLabel={`Target language, ${language.label}`}
            selected={targetLanguage === language.id}
            onPress={() => setTargetLanguage(language.id)}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue"
        disabled={!ready}
        style={[styles.continue, !ready && styles.continueDisabled]}
        onPress={() => {
          if (!nativeLanguage || !targetLanguage) return;
          setProfile({ nativeLanguage, targetLanguage });
        }}>
        <Text style={styles.continueText} lightColor="#fff" darkColor="#000">
          Continue
        </Text>
      </Pressable>
    </View>
  );
}

function Choice({
  label,
  accessibilityLabel,
  selected,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}>
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
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
    opacity: 0.8,
  },
  label: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceSelected: {
    borderColor: '#2f95dc',
    backgroundColor: 'rgba(47, 149, 220, 0.15)',
  },
  choiceText: {
    fontSize: 16,
  },
  continue: {
    marginTop: 20,
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 14,
  },
  continueDisabled: {
    opacity: 0.4,
  },
  continueText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
