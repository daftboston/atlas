import { Placeholder } from '@/components/Placeholder';

export default function FirstSessionScreen() {
  return (
    <Placeholder
      title="First session"
      purpose="Your first short speaking session, with three new phrases."
      next={{ href: '/(onboarding)/habit', label: 'Next' }}
    />
  );
}
