import { isKnownExecutionProfile } from '@blue-quickjs/execution-profiles';
import { monaco } from './monaco.js';
import { formatGas, shortenHash, slugToLabel, toPrettyJson } from './format.js';
import {
  compareAgainstEvidence,
  createScriptArtifact,
  defaultManifestForArtifact,
  findOogBoundary,
  loadPlaygroundData,
  parseArtifactJson,
  runArtifact,
} from './runtime.js';
import {
  getInitialExample,
  getProfileSummary,
  groupExamples,
} from './state.js';
import type {
  GalleryEntry,
  HostPresetId,
  LoadedPlaygroundData,
  OogBoundaryRecord,
  PlaygroundRunResult,
  RedFixtureRecord,
} from './types.js';

type Selection = { type: 'gallery'; id: string } | { type: 'red'; id: string };

export class PlaygroundApp {
  private data: LoadedPlaygroundData | null = null;

  private selection: Selection | null = null;

  private mode: 'gallery' | 'script' | 'artifact' = 'gallery';

  private runResult: PlaygroundRunResult | null = null;

  private activeTab: 'result' | 'evidence' | 'host' | 'metadata' | 'help' =
    'result';

  private hostPreset: HostPresetId = 'determinism';

  private editor: monaco.editor.IStandaloneCodeEditor | null = null;

  private boundaryOverride: OogBoundaryRecord | null = null;

  private scriptProfile = 'baseline-v1';

  private artifactJson = '';

  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async init(): Promise<void> {
    this.root.innerHTML =
      '<div class="bq-loading">Loading BlueQuickjs Playground…</div>';
    this.data = await loadPlaygroundData();
    const initial = getInitialExample(this.data);
    this.selection = { type: 'gallery', id: initial.id };
    this.hostPreset = initial.hostPreset;
    this.renderShell();
    this.renderLists();
    this.syncSelectionToSurface();
    this.bindEvents();
    this.createEditor();
    this.updateEditorForMode();
    this.updatePanels();
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <div class="bq-shell">
        <header class="bq-hero card">
          <div class="bq-brand">
            <div class="bq-logo">B</div>
            <div>
              <p class="eyebrow">web.blue visual language</p>
              <h1>BlueQuickjs Playground</h1>
            </div>
          </div>
          <p class="lede">
            Explore deterministic JavaScript execution with the same wasm32 engine
            and evidence model used by the release process. Consensus-safe scope is
            explicitly <strong>wasm-node vs wasm-browser</strong>; native remains
            diagnostic-only.
          </p>
          <div class="hero-chips">
            <span class="chip accent">Consensus-safe: wasm32 only</span>
            <span class="chip">Exact gas + exact OOG</span>
            <span class="chip">Generated evidence-backed examples</span>
          </div>
        </header>

        <div class="bq-layout">
          <aside class="bq-sidebar">
            <section class="card controls-card">
              <div class="section-heading">
                <h2>Run mode</h2>
                <p>Switch between certified examples, freeform script mode, and artifact JSON import.</p>
              </div>
              <div class="segmented" data-mode-group>
                <button class="segmented-button" data-mode="gallery">Gallery</button>
                <button class="segmented-button" data-mode="script">Script</button>
                <button class="segmented-button" data-mode="artifact">Artifact JSON</button>
              </div>
              <label class="field">
                <span>Execution profile</span>
                <select data-profile>
                  <option value="baseline-v1">baseline-v1</option>
                  <option value="compat-general-v1">compat-general-v1</option>
                  <option value="compat-binary-v1">compat-binary-v1</option>
                </select>
              </label>
              <p class="field-help" data-profile-help></p>
              <label class="field">
                <span>Gas limit</span>
                <input data-gas-limit type="number" min="1" step="1" value="1000000" />
              </label>
              <div class="preset-row">
                <button class="ghost-button" data-gas-preset="50000">50k</button>
                <button class="ghost-button" data-gas-preset="250000">250k</button>
                <button class="ghost-button" data-gas-preset="1000000">1M</button>
                <button class="ghost-button" data-gas-preset="5000000">5M</button>
              </div>
              <label class="field">
                <span>Host preset</span>
                <select data-host-preset>
                  <option value="determinism">Determinism fixture host</option>
                  <option value="certification">Certification host</option>
                </select>
              </label>
              <div class="button-row">
                <button class="primary-button" data-run>Run current selection</button>
                <button class="ghost-button" data-find-oog>Find OOG boundary</button>
              </div>
              <div class="button-row">
                <button class="ghost-button" data-export-artifact>Export artifact</button>
                <button class="ghost-button" data-export-evidence>Export run evidence</button>
              </div>
            </section>

            <section class="card gallery-card">
              <div class="section-heading">
                <h2>Examples</h2>
                <p>Ten canonical examples plus selected certified ecosystem fixtures and red deterministic failures.</p>
              </div>
              <div data-gallery-groups></div>
              <div class="divider"></div>
              <div class="section-heading tight">
                <h3>Red fixtures</h3>
                <p>Deterministic failures are educational, not hidden.</p>
              </div>
              <div class="gallery-list" data-red-list></div>
            </section>
          </aside>

          <main class="bq-main">
            <section class="card editor-card">
              <div class="section-heading inline">
                <div>
                  <h2 data-selection-title></h2>
                  <p data-selection-description></p>
                </div>
                <div class="chip-row">
                  <span class="chip" data-selection-badge></span>
                  <span class="chip" data-selection-cert></span>
                </div>
              </div>
              <div class="meta-strip" data-selection-meta></div>
              <div class="editor-toolbar">
                <span class="eyebrow" data-editor-mode-label></span>
                <span class="eyebrow" data-editor-source-paths></span>
              </div>
              <div class="editor-frame" data-editor></div>
            </section>

            <section class="card results-card">
              <div class="section-heading inline">
                <div>
                  <h2>Run output</h2>
                  <p>Result bytes, gas, host tape, evidence match status, and release pins.</p>
                </div>
                <div class="hero-chips">
                  <span class="chip status" data-run-status>Idle</span>
                  <span class="chip" data-evidence-status>No run yet</span>
                </div>
              </div>
              <div class="metrics-grid" data-metrics-grid></div>
              <div class="tab-row" data-tab-row>
                <button class="tab-button" data-tab="result">Result</button>
                <button class="tab-button" data-tab="evidence">Determinism evidence</button>
                <button class="tab-button" data-tab="host">Host + tape</button>
                <button class="tab-button" data-tab="metadata">Metadata</button>
                <button class="tab-button" data-tab="help">Docs</button>
              </div>
              <div class="tab-panel" data-tab-panel></div>
            </section>
          </main>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>('[data-mode]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          this.mode = button.dataset.mode as typeof this.mode;
          this.updateEditorForMode();
          this.updateControls();
          this.updatePanels();
        });
      });

    this.root
      .querySelector<HTMLSelectElement>('[data-profile]')
      ?.addEventListener('change', (event) => {
        const next = (event.currentTarget as HTMLSelectElement).value;
        if (isKnownExecutionProfile(next)) {
          this.scriptProfile = next;
          this.updateControls();
        }
      });

    this.root
      .querySelector<HTMLInputElement>('[data-gas-limit]')
      ?.addEventListener('change', () => this.updatePanels());

    this.root
      .querySelector<HTMLSelectElement>('[data-host-preset]')
      ?.addEventListener('change', (event) => {
        this.hostPreset = (event.currentTarget as HTMLSelectElement)
          .value as HostPresetId;
        this.updatePanels();
      });

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-gas-preset]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const input =
            this.root.querySelector<HTMLInputElement>('[data-gas-limit]');
          if (input && button.dataset.gasPreset) {
            input.value = button.dataset.gasPreset;
          }
        });
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-run]')
      ?.addEventListener('click', () => void this.runCurrentSelection());
    this.root
      .querySelector<HTMLButtonElement>('[data-find-oog]')
      ?.addEventListener('click', () => void this.findBoundary());
    this.root
      .querySelector<HTMLButtonElement>('[data-export-artifact]')
      ?.addEventListener('click', () => this.exportArtifact());
    this.root
      .querySelector<HTMLButtonElement>('[data-export-evidence]')
      ?.addEventListener('click', () => this.exportEvidence());

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-tab]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          this.activeTab = button.dataset.tab as typeof this.activeTab;
          this.updatePanels();
        });
      });
  }

  private createEditor(): void {
    const mount = this.root.querySelector<HTMLElement>('[data-editor]');
    if (!mount) {
      return;
    }
    this.editor = monaco.editor.create(mount, {
      value: '',
      language: 'javascript',
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily: 'Roboto Mono, monospace',
      fontSize: 14,
      lineHeight: 20,
      scrollBeyondLastLine: false,
      roundedSelection: true,
      readOnly: true,
      theme: 'vs',
      padding: { top: 16, bottom: 16 },
    });
  }

  private renderLists(): void {
    if (!this.data) {
      return;
    }

    const grouped = groupExamples(this.data.examples.examples);
    const groupsMount = this.root.querySelector<HTMLElement>(
      '[data-gallery-groups]',
    );
    const redMount = this.root.querySelector<HTMLElement>('[data-red-list]');

    if (groupsMount) {
      groupsMount.innerHTML = Object.entries(grouped)
        .map(
          ([key, entries]) => `
            <div class="gallery-group">
              <h3>${slugToLabel(key)}</h3>
              <div class="gallery-list">
                ${entries
                  .map(
                    (entry) => `
                      <button class="gallery-item" data-gallery-id="${entry.id}">
                        <strong>${entry.title}</strong>
                        <span>${entry.executionProfile}</span>
                      </button>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          `,
        )
        .join('');

      groupsMount
        .querySelectorAll<HTMLButtonElement>('[data-gallery-id]')
        .forEach((button) => {
          button.addEventListener('click', () => {
            const galleryId = button.dataset.galleryId;
            if (!galleryId) {
              return;
            }
            this.selection = { type: 'gallery', id: galleryId };
            this.mode = 'gallery';
            this.boundaryOverride = null;
            this.runResult = null;
            const current = this.currentGalleryEntry();
            if (current) {
              this.hostPreset = current.hostPreset;
            }
            this.updateEditorForMode();
            this.updateControls();
            this.updatePanels();
          });
        });
    }

    if (redMount) {
      redMount.innerHTML = this.data.red.fixtures
        .map(
          (fixture) => `
            <button class="gallery-item danger" data-red-id="${fixture.id}">
              <strong>${fixture.title}</strong>
              <span>${fixture.failureStage}</span>
            </button>
          `,
        )
        .join('');

      redMount
        .querySelectorAll<HTMLButtonElement>('[data-red-id]')
        .forEach((button) => {
          button.addEventListener('click', () => {
            const redId = button.dataset.redId;
            if (!redId) {
              return;
            }
            this.selection = { type: 'red', id: redId };
            this.mode = 'gallery';
            this.boundaryOverride = null;
            this.runResult = null;
            this.hostPreset = 'certification';
            this.updateEditorForMode();
            this.updateControls();
            this.updatePanels();
          });
        });
    }
  }

  private currentGalleryEntry(): GalleryEntry | null {
    if (!this.data || !this.selection || this.selection.type !== 'gallery') {
      return null;
    }
    return (
      this.data.examples.examples.find(
        (entry) => entry.id === this.selection?.id,
      ) ?? null
    );
  }

  private currentRedFixture(): RedFixtureRecord | null {
    if (!this.data || !this.selection || this.selection.type !== 'red') {
      return null;
    }
    return (
      this.data.red.fixtures.find((entry) => entry.id === this.selection?.id) ??
      null
    );
  }

  private updateEditorForMode(): void {
    if (!this.editor || !this.data) {
      return;
    }

    const selection = this.currentGalleryEntry();
    const redFixture = this.currentRedFixture();
    const modeLabel = this.root.querySelector<HTMLElement>(
      '[data-editor-mode-label]',
    );
    const sourcePaths = this.root.querySelector<HTMLElement>(
      '[data-editor-source-paths]',
    );

    if (this.mode === 'script') {
      const seed = selection?.sourceText ?? 'export default (() => 1 + 2)();\n';
      this.editor.updateOptions({ readOnly: false });
      this.editor.setValue(seed);
      const model = this.editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, 'javascript');
      }
      if (modeLabel) modeLabel.textContent = 'Script mode';
      if (sourcePaths) sourcePaths.textContent = 'Editable JavaScript snippet';
      return;
    }

    if (this.mode === 'artifact') {
      if (!this.artifactJson) {
        this.artifactJson = toPrettyJson(
          selection?.program ??
            redFixture?.runtimeArtifact ??
            createScriptArtifact(
              'export default (() => 1 + 2)();\n',
              this.scriptProfile as GalleryEntry['executionProfile'],
              this.data.examples.metadata,
            ),
        );
      }
      this.editor.updateOptions({ readOnly: false });
      this.editor.setValue(this.artifactJson);
      const model = this.editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, 'json');
      }
      if (modeLabel) modeLabel.textContent = 'Artifact JSON import mode';
      if (sourcePaths)
        sourcePaths.textContent = 'Paste or edit ProgramArtifact.v2 JSON';
      return;
    }

    this.editor.updateOptions({ readOnly: true });
    if (selection) {
      this.editor.setValue(selection.sourceText);
      const model = this.editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(
          model,
          selection.sourcePaths[0]?.endsWith('.ts')
            ? 'typescript'
            : 'javascript',
        );
      }
      if (modeLabel) modeLabel.textContent = 'Certified gallery source';
      if (sourcePaths)
        sourcePaths.textContent = selection.sourcePaths.join(' · ');
    } else if (redFixture) {
      const payload = redFixture.runtimeArtifact ?? {
        diagnostics: redFixture.diagnostics,
        failureStage: redFixture.failureStage,
      };
      this.editor.setValue(toPrettyJson(payload));
      const model = this.editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, 'json');
      }
      if (modeLabel) modeLabel.textContent = 'Deterministic failure fixture';
      if (sourcePaths) sourcePaths.textContent = redFixture.reportSource;
    }
  }

  private updateControls(): void {
    const selection = this.currentGalleryEntry();
    const redFixture = this.currentRedFixture();
    const profileSelect =
      this.root.querySelector<HTMLSelectElement>('[data-profile]');
    const gasInput =
      this.root.querySelector<HTMLInputElement>('[data-gas-limit]');
    const hostPreset =
      this.root.querySelector<HTMLSelectElement>('[data-host-preset]');
    const profileHelp = this.root.querySelector<HTMLElement>(
      '[data-profile-help]',
    );
    const runButton = this.root.querySelector<HTMLButtonElement>('[data-run]');
    const oogButton =
      this.root.querySelector<HTMLButtonElement>('[data-find-oog]');

    if (selection) {
      if (gasInput) gasInput.value = selection.gasLimit;
      if (hostPreset) hostPreset.value = this.hostPreset;
    }
    if (redFixture && gasInput) {
      gasInput.value = '1000000';
    }

    if (profileSelect) {
      profileSelect.value =
        this.mode === 'script'
          ? this.scriptProfile
          : (selection?.executionProfile ?? 'baseline-v1');
      profileSelect.disabled = this.mode !== 'script';
    }

    if (profileHelp) {
      profileHelp.textContent = getProfileSummary(
        (this.mode === 'script'
          ? this.scriptProfile
          : (selection?.executionProfile ?? 'baseline-v1')) as never,
      );
    }

    if (runButton) {
      runButton.disabled =
        this.mode === 'gallery' &&
        redFixture !== null &&
        redFixture.runtimeArtifact === null;
    }

    if (oogButton) {
      oogButton.disabled =
        this.mode === 'gallery'
          ? selection === null || !selection.supportsOogSearch
          : false;
    }

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-mode]')
      .forEach((button) => {
        button.dataset.active = String(button.dataset.mode === this.mode);
      });
    this.root
      .querySelectorAll<HTMLButtonElement>('[data-tab]')
      .forEach((button) => {
        button.dataset.active = String(button.dataset.tab === this.activeTab);
      });
  }

  private syncSelectionToSurface(): void {
    const selection = this.currentGalleryEntry();
    const redFixture = this.currentRedFixture();
    const title = this.root.querySelector<HTMLElement>(
      '[data-selection-title]',
    );
    const description = this.root.querySelector<HTMLElement>(
      '[data-selection-description]',
    );
    const badge = this.root.querySelector<HTMLElement>(
      '[data-selection-badge]',
    );
    const cert = this.root.querySelector<HTMLElement>('[data-selection-cert]');
    const meta = this.root.querySelector<HTMLElement>('[data-selection-meta]');

    if (selection) {
      if (title) title.textContent = selection.title;
      if (description) description.textContent = selection.description;
      if (badge) badge.textContent = selection.badge;
      if (cert)
        cert.textContent = selection.certified
          ? 'Consensus-certified evidence'
          : 'Uncertified';
      if (meta) {
        meta.innerHTML = `
          <span>${selection.executionProfile}</span>
          <span>${selection.sourceKind}</span>
          <span>${selection.abiId}</span>
          <span>${selection.hostSummary.label}</span>
        `;
      }
      return;
    }

    if (redFixture) {
      if (title) title.textContent = redFixture.title;
      if (description) {
        description.textContent =
          redFixture.runtimeArtifact === null
            ? 'Builder rejection fixture that teaches why unsupported code never reaches runtime.'
            : 'Runtime-level deterministic failure fixture with a stable failure stage.';
      }
      if (badge) badge.textContent = 'Red deterministic failure';
      if (cert) cert.textContent = 'Certified deterministic rejection';
      if (meta) {
        meta.innerHTML = `
          <span>${redFixture.executionProfile}</span>
          <span>${redFixture.failureStage}</span>
          <span>${redFixture.reportSource}</span>
        `;
      }
    }
  }

  private updatePanels(): void {
    this.syncSelectionToSurface();
    this.updateControls();
    this.renderMetrics();
    this.renderTabPanel();
  }

  private renderMetrics(): void {
    const mount = this.root.querySelector<HTMLElement>('[data-metrics-grid]');
    const runStatus = this.root.querySelector<HTMLElement>('[data-run-status]');
    const evidenceStatus = this.root.querySelector<HTMLElement>(
      '[data-evidence-status]',
    );
    if (!mount) {
      return;
    }

    if (!this.runResult) {
      mount.innerHTML = `
        <div class="metric-card empty">
          <span class="metric-label">Awaiting run</span>
          <strong>Choose an example, script, or artifact JSON and press Run.</strong>
        </div>
      `;
      if (runStatus) runStatus.textContent = 'Idle';
      if (evidenceStatus) evidenceStatus.textContent = 'No run yet';
      return;
    }

    const currentId =
      this.selection?.type === 'gallery' || this.selection?.type === 'red'
        ? this.selection.id
        : null;
    const evidence =
      currentId && this.data
        ? this.data.evidence.evidence[currentId]
        : undefined;
    const match = compareAgainstEvidence(this.runResult, evidence);
    if (runStatus)
      runStatus.textContent = this.runResult.ok ? 'Success' : 'Failure';
    if (evidenceStatus) {
      evidenceStatus.textContent = !match.available
        ? 'No certified evidence'
        : match.matches
          ? 'Matches certified snapshot'
          : 'Differs from certified snapshot';
    }

    mount.innerHTML = [
      metricCard('Stage', this.runResult.snapshot.stage),
      metricCard('Gas used', formatGas(this.runResult.snapshot.gasUsed)),
      metricCard(
        'Gas remaining',
        formatGas(this.runResult.snapshot.gasRemaining),
      ),
      metricCard('Tape length', String(this.runResult.snapshot.tapeLength)),
      metricCard(
        'Result hash',
        shortenHash(this.runResult.snapshot.resultHash),
      ),
      metricCard('Tape hash', shortenHash(this.runResult.snapshot.tapeHash)),
      metricCard(
        'engineBuildHash',
        shortenHash(this.runResult.runtimeMetadata.engineBuildHash),
      ),
      metricCard(
        'gasVersion',
        this.runResult.runtimeMetadata.gasVersion?.toString() ?? '—',
      ),
    ].join('');
  }

  private renderTabPanel(): void {
    const mount = this.root.querySelector<HTMLElement>('[data-tab-panel]');
    if (!mount || !this.data) {
      return;
    }

    const selection = this.currentGalleryEntry();
    const redFixture = this.currentRedFixture();
    const evidenceKey =
      this.selection?.type === 'gallery' || this.selection?.type === 'red'
        ? this.selection.id
        : '';
    const evidence = this.data.evidence.evidence[evidenceKey];
    const boundary =
      this.boundaryOverride ??
      (evidenceKey ? this.data.oog.boundaries[evidenceKey] : undefined);

    if (this.activeTab === 'help') {
      const links = selection?.docsLinks ?? redFixture?.docsLinks ?? [];
      mount.innerHTML = `
        <div class="stack">
          <p class="panel-note">Use these docs to learn the current selection and verify its deterministic scope.</p>
          <ul class="link-list">
            ${links
              .map(
                (link) =>
                  `<li><a href="${link.href}" target="_blank" rel="noreferrer">${link.label}</a></li>`,
              )
              .join('')}
          </ul>
        </div>
      `;
      return;
    }

    if (this.activeTab === 'metadata') {
      const runtimeMetadata = this.runResult?.runtimeMetadata;
      mount.innerHTML = `
        <div class="stack">
          <pre>${toPrettyJson({
            selection: selection ??
              redFixture ?? {
                mode: this.mode,
                scriptProfile: this.scriptProfile,
              },
            runtimeMetadata,
            certifiedBoundary: boundary ?? null,
          })}</pre>
        </div>
      `;
      return;
    }

    if (this.activeTab === 'host') {
      mount.innerHTML = `
        <div class="stack">
          <p class="panel-note">${
            selection?.hostSummary.description ??
            'Host activity is captured through wrapped mock handlers plus tape hashes.'
          }</p>
          <pre>${toPrettyJson(this.runResult?.hostEvents ?? [])}</pre>
        </div>
      `;
      return;
    }

    if (this.activeTab === 'evidence') {
      if (redFixture) {
        mount.innerHTML = `
          <div class="stack">
            <p class="panel-note">Red fixtures teach deterministic failures instead of hiding them.</p>
            <pre>${toPrettyJson({
              failureStage: redFixture.failureStage,
              errorCode: redFixture.errorCode,
              errorTag: redFixture.errorTag,
              diagnostics: redFixture.diagnostics,
            })}</pre>
          </div>
        `;
        return;
      }

      const comparison = this.runResult
        ? compareAgainstEvidence(this.runResult, evidence)
        : null;
      mount.innerHTML = `
        <div class="stack">
          <pre>${toPrettyJson({
            certifiedEvidence: evidence ?? null,
            currentRun: this.runResult?.snapshot ?? null,
            comparison,
            certifiedBoundary: boundary ?? null,
          })}</pre>
        </div>
      `;
      return;
    }

    mount.innerHTML = `
      <div class="stack">
        <pre>${toPrettyJson({
          ok: this.runResult?.ok ?? null,
          snapshot: this.runResult?.snapshot ?? null,
          value: this.runResult?.value ?? null,
          errorMessage: this.runResult?.errorMessage ?? null,
        })}</pre>
      </div>
    `;
  }

  private async runCurrentSelection(): Promise<void> {
    if (!this.data) {
      return;
    }

    try {
      let artifact;
      let manifest;
      const gasLimit = BigInt(
        this.root.querySelector<HTMLInputElement>('[data-gas-limit]')?.value ??
          '1000000',
      );
      const selection = this.currentGalleryEntry();
      const redFixture = this.currentRedFixture();

      if (this.mode === 'script') {
        artifact = createScriptArtifact(
          this.editor?.getValue() ?? '',
          this.scriptProfile as GalleryEntry['executionProfile'],
          this.data.examples.metadata,
        );
        manifest = defaultManifestForArtifact(artifact);
      } else if (this.mode === 'artifact') {
        this.artifactJson = this.editor?.getValue() ?? '{}';
        artifact = parseArtifactJson(this.artifactJson);
        manifest = defaultManifestForArtifact(artifact);
      } else if (selection) {
        artifact = selection.program;
        manifest = selection.manifest;
      } else if (redFixture?.runtimeArtifact) {
        artifact = redFixture.runtimeArtifact;
        manifest = defaultManifestForArtifact(artifact);
      } else {
        return;
      }

      this.runResult = await runArtifact({
        artifact,
        manifest,
        gasLimit,
        hostPreset: this.hostPreset,
      });
      this.activeTab = this.runResult.ok ? 'result' : 'evidence';
      this.updatePanels();
    } catch (error) {
      this.runResult = {
        ok: false,
        snapshot: {
          stage: 'artifact_validation',
          resultHash: null,
          errorCode: 'PROGRAM_ARTIFACT_INVALID',
          errorTag: 'vm/module_pack',
          gasUsed: '0',
          gasRemaining: '0',
          tapeHash: null,
          tapeLength: 0,
        },
        value: null,
        errorMessage: error instanceof Error ? error.message : String(error),
        hostEvents: [],
        tape: [],
        runtimeMetadata: {
          engineBuildHash: this.data.examples.metadata.engineBuildHash,
          gasVersion: this.data.examples.metadata.gasVersion,
          executionProfile: this.scriptProfile,
          sourceKind: 'script',
          abiId: this.hostPreset === 'certification' ? 'Host.v2' : 'Host.v1',
          moduleGraphHash: null,
        },
      };
      this.activeTab = 'evidence';
      this.updatePanels();
    }
  }

  private async findBoundary(): Promise<void> {
    if (!this.data) {
      return;
    }

    let artifact;
    let manifest;
    const initialGasLimit = BigInt(
      this.root.querySelector<HTMLInputElement>('[data-gas-limit]')?.value ??
        '1000000',
    );
    const selection = this.currentGalleryEntry();
    const redFixture = this.currentRedFixture();

    if (this.mode === 'script') {
      artifact = createScriptArtifact(
        this.editor?.getValue() ?? '',
        this.scriptProfile as GalleryEntry['executionProfile'],
        this.data.examples.metadata,
      );
      manifest = defaultManifestForArtifact(artifact);
    } else if (this.mode === 'artifact') {
      artifact = parseArtifactJson(this.editor?.getValue() ?? '{}');
      manifest = defaultManifestForArtifact(artifact);
    } else if (selection) {
      artifact = selection.program;
      manifest = selection.manifest;
    } else if (redFixture?.runtimeArtifact) {
      artifact = redFixture.runtimeArtifact;
      manifest = defaultManifestForArtifact(artifact);
    } else {
      return;
    }

    this.boundaryOverride = await findOogBoundary({
      artifact,
      manifest,
      hostPreset: this.hostPreset,
      initialGasLimit,
    });
    this.activeTab = 'evidence';
    this.updatePanels();
  }

  private exportArtifact(): void {
    if (!this.data) {
      return;
    }
    const selection = this.currentGalleryEntry();
    const redFixture = this.currentRedFixture();
    let artifactContent = '{}\n';
    if (this.mode === 'artifact') {
      artifactContent = this.editor?.getValue() ?? '{}\n';
    } else if (this.mode === 'script') {
      artifactContent = toPrettyJson(
        createScriptArtifact(
          this.editor?.getValue() ?? '',
          this.scriptProfile as GalleryEntry['executionProfile'],
          this.data.examples.metadata,
        ),
      );
    } else if (selection) {
      artifactContent = toPrettyJson(selection.program);
    } else if (redFixture?.runtimeArtifact) {
      artifactContent = toPrettyJson(redFixture.runtimeArtifact);
    }
    downloadFile('bluequickjs-artifact.json', artifactContent);
  }

  private exportEvidence(): void {
    const payload = toPrettyJson({
      selection: this.selection,
      runResult: this.runResult,
      boundary: this.boundaryOverride,
    });
    downloadFile('bluequickjs-run-evidence.json', payload);
  }
}

function metricCard(label: string, value: string): string {
  return `
    <div class="metric-card">
      <span class="metric-label">${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function downloadFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
