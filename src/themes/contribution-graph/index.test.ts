import { describe, expect, it } from 'vitest';
import { CONTRIBUTION_GRAPH_CONFIG } from './config';
import * as entrypoint from './index';
import { contributionGraphLandingPageRenderer } from './renderers/landing-page-renderer';
import { createCanvasTimePageRenderer } from './renderers/time-page-renderer';

/** Tests for contribution-graph theme entry point exports. */
describe('contribution-graph index', () => {
  it('should export configuration and renderer factories when the entry module loads', () => {
    expect(entrypoint.CONTRIBUTION_GRAPH_CONFIG).toBe(CONTRIBUTION_GRAPH_CONFIG);
    // The index re-exports createCanvasTimePageRenderer as contributionGraphTimePageRenderer
    expect(entrypoint.contributionGraphTimePageRenderer).toBe(createCanvasTimePageRenderer);
    expect(entrypoint.contributionGraphLandingPageRenderer).toBe(contributionGraphLandingPageRenderer);
  });

  it('should expose export names expected by the registry when importing the theme module', () => {
    const { CONTRIBUTION_GRAPH_CONFIG: config, contributionGraphTimePageRenderer: timeRenderer, contributionGraphLandingPageRenderer: landingRenderer } = entrypoint;

    expect(config).toBeDefined();
    expect(typeof timeRenderer).toBe('function');
    expect(typeof landingRenderer).toBe('function');
  });
});