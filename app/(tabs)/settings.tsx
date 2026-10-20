import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { ChoiceRow, Group, ScreenTitle, SectionFooter, SectionHeader, StepperRow, TextButton } from '@/components/ui/ios';
import { languageLabel } from '@/content/sample-lesson';
import { DAILY_NEW_LIMIT_MAX, DAILY_NEW_LIMIT_MIN, RETENTION_CHOICES, SESSION_SIZE_MAX, SESSION_SIZE_MIN } from '@/domain/config';
import { SPANISH_ACCENTS } from '@/domain/language/profiles/es';
import { chooseAccent } from '@/state/accent';
import { DEV_SCRIPT_NAMES, setDevScript, useDevScript } from '@/state/devSpeechScript';
import { clearProfile, useLearner } from '@/state/learnerStore';
import { setScreenTimeSimulation } from '@/services/screenTime/stub';
import { refreshSessionHome } from '@/state/sessionStore';
import { setDailyNewLimit, setDesiredRetention, setSessionSize, useSettings } from '@/state/settingsStore';

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function SettingsScreen() {
  const { profile } = useLearner();
  const settings = useSettings();
  const script = useDevScript();
  const [screenTimeOn, setScreenTimeOn] = useState(false);
  const accent = settings.speechLocale ?? SPANISH_ACCENTS[0].locale;

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <ScreenTitle>Settings</ScreenTitle>
      {!profile ? <Text style={styles.copy}>Course not started yet.</Text> : null}
      {profile ? (
        <View style={styles.section}>
          <SectionHeader>Course</SectionHeader>
          <Group>
            <View style={styles.courseRow}>
              <Text style={styles.courseTitle}>
                Learning {languageLabel(profile.targetLanguage)} from {languageLabel(profile.nativeLanguage)}
              </Text>
            </View>
          </Group>
          <SectionFooter>Atlas starts with English to Spanish. More languages are coming later.</SectionFooter>
        </View>
      ) : null}

      {profile ? (
        <View style={styles.section}>
          <SectionHeader>Accent</SectionHeader>
          <Group>
            {SPANISH_ACCENTS.map((choice) => (
              <ChoiceRow
                key={choice.label}
                label={choice.label}
                selected={accent === choice.locale}
                onPress={() => chooseAccent(choice.locale)}
              />
            ))}
          </Group>
          <SectionFooter>This is the voice Atlas uses when it says a phrase.</SectionFooter>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader>Practice</SectionHeader>
        <Group>
          <StepperRow
            label="New phrases a day"
            value={settings.dailyNewLimit}
            canDecrease={settings.dailyNewLimit > DAILY_NEW_LIMIT_MIN}
            canIncrease={settings.dailyNewLimit < DAILY_NEW_LIMIT_MAX}
            decreaseLabel="Fewer new phrases"
            increaseLabel="More new phrases"
            onDecrease={() => {
              setDailyNewLimit(settings.dailyNewLimit - 1);
              refreshSessionHome();
            }}
            onIncrease={() => {
              setDailyNewLimit(settings.dailyNewLimit + 1);
              refreshSessionHome();
            }}
          />
          <StepperRow
            label="Phrases in a session"
            value={settings.sessionSize}
            canDecrease={settings.sessionSize > SESSION_SIZE_MIN}
            canIncrease={settings.sessionSize < SESSION_SIZE_MAX}
            decreaseLabel="Shorter session"
            increaseLabel="Longer session"
            onDecrease={() => {
              setSessionSize(settings.sessionSize - 1);
              refreshSessionHome();
            }}
            onIncrease={() => {
              setSessionSize(settings.sessionSize + 1);
              refreshSessionHome();
            }}
          />
        </Group>
        <SectionFooter>A session is the most phrases Atlas will ask for at once. New phrases stop for the day when you reach the daily number.</SectionFooter>
      </View>

      <View style={styles.section}>
        <SectionHeader>Review timing</SectionHeader>
        <Group>
          {RETENTION_CHOICES.map((choice) => (
            <ChoiceRow
              key={choice}
              label={percent(choice)}
              selected={settings.desiredRetention === choice}
              onPress={() => setDesiredRetention(choice)}
            />
          ))}
        </Group>
        <SectionFooter>Higher means Atlas brings a phrase back sooner. 90% is the starting point.</SectionFooter>
      </View>

      <View style={styles.section}>
        <SectionHeader>Microphone and Screen Time</SectionHeader>
        <Group>
          <View style={styles.note}>
            <Text style={styles.copy}>
              Listening and speaking use a simulated microphone in this build. Screen Time is not connected, so an unlock is a timer on this phone.
            </Text>
          </View>
        </Group>
        <SectionFooter>
          Choosing which apps to block needs a physical iPhone and a paid Apple Developer account. This Mac cannot block other apps.
        </SectionFooter>
      </View>

      {__DEV__ ? (
        <View style={styles.section}>
          <SectionHeader>Developer</SectionHeader>
          <Group>
            {DEV_SCRIPT_NAMES.map((name) => (
              <ChoiceRow
                key={name}
                label={name}
                accessibilityLabel={`Simulated answer, ${name}`}
                selected={script === name}
                onPress={() => setDevScript(name)}
              />
            ))}
            <ChoiceRow
              label="Simulate Screen Time"
              selected={screenTimeOn}
              onPress={() => {
                const next = !screenTimeOn;
                setScreenTimeOn(next);
                setScreenTimeSimulation(next);
              }}
            />
          </Group>
          <SectionFooter>The simulated answer is what Repeat hears next. Screen Time simulation does not block other apps.</SectionFooter>
        </View>
      ) : null}

      {profile ? (
        <View style={styles.section}>
          <Group>
            <TextButton label="Show course setup again" destructive onPress={clearProfile} />
          </Group>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 22, paddingBottom: 128 },
  section: { gap: 0 },
  courseRow: { paddingHorizontal: 16, paddingVertical: 12 },
  courseTitle: { fontSize: 17, lineHeight: 22 },
  note: { paddingHorizontal: 16, paddingVertical: 12 },
  copy: { fontSize: 17, lineHeight: 22 },
});