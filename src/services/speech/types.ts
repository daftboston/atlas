import type { SpeechError, TextMatchResult } from '@/domain/scoring/types';

export type { SpeechError, TextMatchResult as ScoreResult, WordScore } from '@/domain/scoring/types';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export type SpeechCapabilities = {
  stt: boolean;
  tts: boolean;
  scoring: 'text-match' | 'phoneme';
  onDevice: boolean;
  /** BCP-47 locales this engine can actually hear and speak. */
  locales: string[];
};

export type ListenOptions = {
  locale: string;
  maxDurationMs?: number;
  silenceTimeoutMs?: number;
  contextPhrases?: string[];
};

export type ListenResult = {
  transcript: string;
  confidence: number | null;
  durationMs: number;
  endedBy: 'silence' | 'maxDuration' | 'user' | 'error';
  /** Always null in v0. Recordings are not kept (OQ-5). */
  audioUri: null;
  error?: SpeechError;
};

export type ListenSession = {
  onPartial(cb: (partialTranscript: string) => void): () => void;
  onLevel(cb: (level0to1: number) => void): () => void;
  /** Learner ends early. `endedBy` is `user`. */
  stop(): void;
  /** Discard. `result` rejects with an Error whose message is `cancelled`. */
  cancel(): void;
  result: Promise<ListenResult>;
};

export type ScoreInput = {
  target: string;
  variants: string[];
  transcript: string;
  inputMode: 'speech' | 'typed';
  locale: string;
  reading: string | null;
  romanization: string | null;
  audioUri: string | null;
};

export type SpeechService = {
  capabilities(): Promise<SpeechCapabilities>;
  getPermission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  /** Only one listen at a time. A second call cancels the first. Starting listen stops playback. */
  listen(opts: ListenOptions): ListenSession;
  /** Resolves when playback ends. Starting listen stops this first. */
  speak(text: string, opts: { locale: string; rate?: number }): Promise<void>;
  stopSpeaking(): Promise<void>;
  score(input: ScoreInput): Promise<TextMatchResult>;
};
