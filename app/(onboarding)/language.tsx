import { Placeholder } from '@/components/Placeholder';

export default function LanguageScreen() {
  return (
    <Placeholder
      title="Your course"
      purpose="Choose your course and the accent you want to hear."
      next={{ href: '/(onboarding)/mic', label: 'Next' }}
    />
  );
}
