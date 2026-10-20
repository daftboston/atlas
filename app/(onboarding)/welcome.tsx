import { useRouter } from 'expo-router';

import { OnboardingFrame, PrimaryButton } from '@/components/ui/ios';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <OnboardingFrame
      title="Welcome"
      copy="Atlas gets you speaking from the first minute, in short daily sessions."
      footer={<PrimaryButton label="Next" onPress={() => router.push('/(onboarding)/language')} />}
    />
  );
}
