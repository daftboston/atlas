import { render, screen } from '@testing-library/react-native';

import TabOneScreen from '@/app/(tabs)/index';

describe('Home tab', () => {
  it('renders the home screen', async () => {
    await render(<TabOneScreen />);

    expect(screen.getByText('Tab One')).toBeOnTheScreen();
  });
});
