import {
  TraceMap,
  originalPositionFor,
  type OriginalMapping,
} from '@jridgewell/trace-mapping';
import type { ModulePackV1 } from './quickjs-runtime.js';

const GENERATED_LOCATION_RE = /(\.{0,2}\/[^\s:()]+\.m?js):(\d+):(\d+)/g;

interface ParsedSourceMapShape {
  version: number;
  sources: string[];
  names: string[];
  mappings: string;
  [key: string]: unknown;
}

export interface RemappedStackLocation {
  generatedSpecifier: string;
  generatedLine: number;
  generatedColumn: number;
  source: string;
  line: number;
  column: number;
}

export interface RemapPayloadResult {
  payload: string;
  locations: RemappedStackLocation[];
}

export function remapModulePackErrorPayload(
  payload: string,
  modulePack: ModulePackV1,
): RemapPayloadResult {
  const traceMapsBySpecifier = buildTraceMapLookup(modulePack);
  if (traceMapsBySpecifier.size === 0) {
    return { payload, locations: [] };
  }

  const locations: RemappedStackLocation[] = [];
  const remappedPayload = payload.replace(
    GENERATED_LOCATION_RE,
    (match, specifier, lineText, columnText) => {
      const generatedLine = Number(lineText);
      const generatedColumn = Number(columnText);
      if (
        !Number.isInteger(generatedLine) ||
        !Number.isInteger(generatedColumn) ||
        generatedLine <= 0 ||
        generatedColumn <= 0
      ) {
        return match;
      }

      const traceMap =
        traceMapsBySpecifier.get(specifier) ??
        traceMapsBySpecifier.get(normalizeSpecifier(specifier));
      if (!traceMap) {
        return match;
      }

      const original = resolveOriginalPosition(traceMap, {
        line: generatedLine,
        column: generatedColumn,
      });
      if (!original) {
        return match;
      }

      locations.push({
        generatedSpecifier: specifier,
        generatedLine,
        generatedColumn,
        source: original.source,
        line: original.line,
        column: original.column,
      });

      return `${original.source}:${original.line}:${original.column}`;
    },
  );

  return { payload: remappedPayload, locations };
}

function buildTraceMapLookup(modulePack: ModulePackV1): Map<string, TraceMap> {
  const lookup = new Map<string, TraceMap>();
  for (const module of modulePack.modules) {
    if (!module.sourceMap) {
      continue;
    }
    try {
      const decodedMap = JSON.parse(module.sourceMap) as ParsedSourceMapShape;
      const traceMap = new TraceMap(
        decodedMap as unknown as ConstructorParameters<typeof TraceMap>[0],
      );
      lookup.set(module.specifier, traceMap);
      lookup.set(normalizeSpecifier(module.specifier), traceMap);
    } catch {
      // Ignore malformed source maps; leave payload unchanged.
    }
  }
  return lookup;
}

function normalizeSpecifier(specifier: string): string {
  if (specifier.startsWith('./')) {
    return specifier.slice(2);
  }
  return specifier;
}

function resolveOriginalPosition(
  traceMap: TraceMap,
  generated: { line: number; column: number },
): { source: string; line: number; column: number } | null {
  const mapping = originalPositionFor(traceMap, {
    line: generated.line,
    column: Math.max(0, generated.column - 1),
  }) as OriginalMapping | null;

  if (!mapping || mapping.line == null || mapping.column == null) {
    return null;
  }

  const source = mapping.source ?? '<unknown>';
  return {
    source,
    line: mapping.line,
    column: mapping.column + 1,
  };
}
