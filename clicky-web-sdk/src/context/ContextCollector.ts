import type { ClickyCapturedContext, NormalizedClickyOptions } from "../core/types";
import { ElementRegistry } from "./ElementRegistry";
import { DomSnapshot } from "./DomSnapshot";
import { SemanticGraph } from "./SemanticGraph";
import { ScreenshotCapture } from "./ScreenshotCapture";

export class ContextCollector {
  private readonly domSnapshot: DomSnapshot;
  private readonly semanticGraph: SemanticGraph;
  private readonly screenshotCapture = new ScreenshotCapture();
  private semanticMapVersion = 0;

  constructor(
    private readonly options: NormalizedClickyOptions,
    readonly elementRegistry: ElementRegistry
  ) {
    this.domSnapshot = new DomSnapshot(options, elementRegistry);
    this.semanticGraph = new SemanticGraph(options, elementRegistry);
  }

  async capture(options: { includeScreenshot?: boolean } = {}): Promise<ClickyCapturedContext> {
    const domSnapshotResult = this.domSnapshot.capture();
    const semanticGraph = this.semanticGraph.build();
    const screenshots = [];

    if (options.includeScreenshot && this.options.enableScreenshots && this.options.contextMode !== "dom-only") {
      screenshots.push(await this.screenshotCapture.captureStill());
    }

    return {
      semanticMapVersion: this.semanticMapVersion,
      appName: this.options.appName,
      tenantId: this.options.tenantId,
      userId: this.options.userId,
      sessionId: this.options.sessionId,
      url: window.location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      },
      pageText: domSnapshotResult.pageText,
      elements: domSnapshotResult.elements,
      semanticGraph,
      screenshots,
      capturedAt: new Date().toISOString()
    };
  }

  markDomChanged(): number {
    this.semanticMapVersion += 1;
    return this.semanticMapVersion;
  }

  getSemanticMapVersion(): number {
    return this.semanticMapVersion;
  }
}
