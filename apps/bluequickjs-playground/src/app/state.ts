import {
  getExecutionProfileCapabilities,
  type PublicExecutionProfile,
} from '@blue-quickjs/execution-profiles';
import type {
  GalleryEntry,
  LoadedPlaygroundData,
  RedFixtureRecord,
} from './types.js';

export type RunMode = 'gallery' | 'script' | 'artifact';

export type ResultTab = 'result' | 'evidence' | 'host' | 'metadata' | 'help';

export function getInitialExample(data: LoadedPlaygroundData): GalleryEntry {
  return data.examples.examples[0];
}

export function groupExamples(entries: GalleryEntry[]): Record<string, GalleryEntry[]> {
  return entries.reduce<Record<string, GalleryEntry[]>>((groups, entry) => {
    const key = entry.kind;
    groups[key] ??= [];
    groups[key].push(entry);
    return groups;
  }, {});
}

export function getProfileSummary(profile: PublicExecutionProfile): string {
  const capabilities = getExecutionProfileCapabilities(profile);
  if (capabilities.length === 0) {
    return 'Minimal consensus baseline with no Promise jobs or binary APIs.';
  }
  return capabilities.join(', ');
}

export function getRedFixtureMap(
  redFixtures: RedFixtureRecord[],
): Map<string, RedFixtureRecord> {
  return new Map(redFixtures.map((fixture) => [fixture.id, fixture]));
}
