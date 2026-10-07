import { LanguageSetup } from '@/components/LanguageSetup';
import { SampleLesson } from '@/components/SampleLesson';
import { useLearner } from '@/lib/learner-store';

export default function LearnScreen() {
  const { profile } = useLearner();
  if (!profile) return <LanguageSetup />;
  return <SampleLesson />;
}
