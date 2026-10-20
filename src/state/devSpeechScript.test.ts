import { resetDevScript, scriptedStep, setDevScript, getDevScript } from '@/state/devSpeechScript';

it('builds a matching, a close, and an empty listen step from the dev script', () => {
  expect(scriptedStep('perfect', 'Hola').transcript).toBe('Hola');
  expect(scriptedStep('close', 'Hola').transcript).toBe('Hol');
  expect(scriptedStep('silence', 'Hola').error).toBe('noSpeech');
  setDevScript('silence');
  expect(getDevScript()).toBe('silence');
  resetDevScript();
  expect(getDevScript()).toBe('perfect');
});
