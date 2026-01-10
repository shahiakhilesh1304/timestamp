/**
 * Canvas rendering utilities for contribution-graph theme.
 *
 * @remarks
 * This module consolidates all canvas-based rendering functionality:
 * - Renderer: Core canvas rendering engine with dirty-rect optimization
 * - State: Grid state management with square tracking
 * - Ambient: Background activity animations
 * - Digits: Countdown number rendering
 * - Celebration: Message text rendering
 * - Wall Build: Brick-laying animation effects
 */

export {
type AmbientState,
    createAmbientState,
    getAmbientIntensity,
    getTickInterval,
    manageAmbientActivity,
    setPhase,
    startAmbient,
    stopAmbient,
    updateAmbientAnimations} from './ambient';
export {
    clearCelebrationMessage,
    renderCelebrationMessage
} from './celebration';
export {
    clearDigits,
    updateDigits
} from './digits';
export {
type CanvasRenderer,
    createCanvasRenderer} from './renderer';
export {
    calculateGridDimensions, type CanvasGridState, clearDirty,
    createCanvasGridState,
    getSquare,
    markDirty,
    markFullRepaint,
    resetSquares, type SquareState
} from './state';
export {
    buildWall,
    clearWall,
    unbuildWall
} from './wall-build';

