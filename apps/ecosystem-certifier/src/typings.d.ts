import type { BrowserEvaluationCase, FixtureParityRecord } from './shared/types.js';

declare global {
  interface Window {
    __ECOSYSTEM_CERT_CASES__?: BrowserEvaluationCase[];
    __ECOSYSTEM_CERT_RESULTS__?: FixtureParityRecord[];
    __ECOSYSTEM_CERT_RUNSTATE__?: 'idle' | 'running' | 'done' | 'error';
  }
}

export {};
