import {
  type AbiManifest,
  type CanonicalAbiManifest,
} from '@blue-quickjs/abi-manifest';
import {
  type QuickjsWasmArtifact,
  type QuickjsWasmBuildMetadata,
  type QuickjsWasmBuildType,
  type QuickjsWasmVariant,
  getQuickjsWasmArtifact,
  loadQuickjsWasmBinary,
  loadQuickjsWasmMetadata,
} from '@blue-quickjs/quickjs-wasm';
import {
  createHostCallImport,
  createHostDispatcher,
  type HostCallImport,
  type HostCallMemory,
  type HostDispatcher,
  type HostDispatcherHandlers,
  type HostDispatcherOptions,
} from './host-dispatcher.js';

const UINT32_MAX = 0xffffffff;
const DEFAULT_VARIANT: QuickjsWasmVariant = 'wasm32';
const DEFAULT_BUILD_TYPE: QuickjsWasmBuildType = 'release';

export interface QuickjsWasmModule {
  HEAPU8: Uint8Array;
  cwrap<T extends (...args: unknown[]) => unknown>(
    ident: string,
    returnType: string | null,
    argTypes: Array<string | null>,
  ): T;
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;
  _malloc(size: number): number;
  _free(ptr: number): void;
  // The module exposes an internal ready promise, but the factory already awaits it.
  ready?: Promise<unknown>;
}

export interface RuntimeArtifactSelection {
  variant?: QuickjsWasmVariant;
  buildType?: QuickjsWasmBuildType;
  metadata?: QuickjsWasmBuildMetadata;
  wasmBinary?: Uint8Array;
}

export interface CreateRuntimeOptions
  extends HostDispatcherOptions, RuntimeArtifactSelection {
  manifest: AbiManifest;
  handlers: HostDispatcherHandlers;
}

export interface RuntimeInstance {
  module: QuickjsWasmModule;
  dispatcher: HostDispatcher;
  hostCall: HostCallImport;
  manifest: CanonicalAbiManifest;
  artifact: QuickjsWasmArtifact;
  metadata: QuickjsWasmBuildMetadata;
  variant: QuickjsWasmVariant;
  buildType: QuickjsWasmBuildType;
}

type QuickjsWasmModuleFactory = (opts: {
  host: { host_call: HostCallImport };
  locateFile?: (path: string, scriptDirectory?: string) => string;
  wasmBinary?: ArrayBufferView | ArrayBuffer;
}) => Promise<QuickjsWasmModule>;

export async function createRuntime(
  options: CreateRuntimeOptions,
): Promise<RuntimeInstance> {
  const variant = options.variant ?? DEFAULT_VARIANT;
  const buildType = options.buildType ?? DEFAULT_BUILD_TYPE;

  if (variant !== 'wasm32') {
    throw new Error(
      `quickjs-runtime supports wasm32 only; host_call pointers are 32-bit (received variant=${variant})`,
    );
  }

  const metadata =
    options.metadata ??
    (await loadQuickjsWasmMetadata().catch((error) => {
      throw new Error(`Failed to load QuickJS wasm metadata: ${String(error)}`);
    }));
  const artifact = await getQuickjsWasmArtifact(variant, buildType, metadata);

  const wasmBinary =
    options.wasmBinary ??
    (await loadQuickjsWasmBinary(variant, buildType, metadata));

  const dispatcher = createHostDispatcher(
    options.manifest,
    options.handlers,
    options,
  );

  const hostMemory: HostCallMemory = { buffer: new ArrayBuffer(0) };
  const hostCall = createHostCallImport(dispatcher, hostMemory);
  const guardedHostCall: HostCallImport = (...args) => {
    if (hostMemory.buffer.byteLength === 0) {
      return UINT32_MAX;
    }
    return hostCall(...args);
  };

  const moduleFactory = (await import(artifact.loaderUrl.href))
    .default as QuickjsWasmModuleFactory;

  const module = await moduleFactory({
    host: { host_call: guardedHostCall },
    wasmBinary: toArrayBuffer(wasmBinary),
    locateFile: (path: string) =>
      path.endsWith('.wasm') ? artifact.wasmUrl.href : path,
  });

  const buffer = module?.HEAPU8?.buffer as ArrayBuffer | undefined;
  if (!buffer) {
    throw new Error('QuickJS wasm module did not expose linear memory');
  }
  hostMemory.buffer = buffer;

  return {
    module,
    dispatcher,
    hostCall,
    manifest: dispatcher.manifest,
    artifact,
    metadata,
    variant,
    buildType,
  };
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) {
    return view.buffer as ArrayBuffer;
  }
  return view.slice().buffer;
}
