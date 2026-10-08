import { StyleSheet } from 'react-native';

import { LanguageSetup } from '@/components/LanguageSetup';
import { SampleLesson } from '@/components/SampleLesson';
import { SessionHome } from '@/components/practice/SessionHome';
import { View } from '@/components/Themed';
import { useLearner } from '@/state/learnerStore';

export default function LearnScreen() {
  const { profile } = useLearner();
  if (!profile) return <LanguageSetup />;
  return (
    <View style={styles.screen}>
      <SessionHome />
      <SampleLesson />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
