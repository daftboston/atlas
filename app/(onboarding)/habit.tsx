import { useRouter } from 'expo-router';

import { OnboardingFrame, PrimaryButton, TextButton } from '@/components/ui/ios';

export default function HabitScreen() {
  const router = useRouter();
  return (
    <OnboardingFrame
      title="Daily habit"
      copy="A finished session can earn a few free minutes. Screen Time is coming later, so for now Atlas shows a timer."
      footer={
        <>
          <PrimaryButton label="Next" onPress={() => router.push('/(onboarding)/done')} />
          <TextButton label="Skip" onPress={() => router.push('/(onboarding)/done')} />
        </>
      }
    />
  );
}
