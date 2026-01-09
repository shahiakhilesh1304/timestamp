/**
 * Contribution Graph Theme
 *
 * GitHub contribution graph style countdown with pixel-art digits.
 *
 * @remarks
 * Entry point for the contribution-graph theme. Exports theme configuration
 * and renderer factories for registry integration.
 *
 * PERFORMANCE: Uses canvas-based rendering instead of 5000+ DOM elements.
 * This eliminates WindowServer compositor overhead on macOS (49% to under 10% CPU).
 */

import './styles.scss';

/** Theme configuration metadata and color scheme. */
export { CONTRIBUTION_GRAPH_CONFIG } from './config';

/** Time page renderer factory (canvas-based countdown display). */
export { createCanvasTimePageRenderer as contributionGraphTimePageRenderer } from './renderers/time-page-renderer';

/** Landing page renderer factory (animated background). */
export { contributionGraphLandingPageRenderer } from './renderers/landing-page-renderer';
