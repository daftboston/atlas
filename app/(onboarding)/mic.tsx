import { Placeholder } from '@/components/Placeholder';

export default function MicScreen() {
  return (
    <Placeholder
      title="Microphone"
      purpose="Atlas will explain why it needs the microphone, then ask for permission."
      next={{ href: '/(onboarding)/first-session', label: 'Next' }}
    />
  );
}
