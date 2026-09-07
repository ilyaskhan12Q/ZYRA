/**
 * Built-in default correlation ruleset for Phase 05.
 */

import { type CorrelationRule } from '../types.js';
import { CORR_IMAGE_ASSET_RULE } from './image-asset.js';
import { CORR_FONT_ASSET_RULE } from './font-asset.js';
import { CORR_RENDER_BLOCKING_RULE } from './render-blocking.js';
import { CORR_SCRIPT_IMPORT_RULE } from './script-import.js';
import { CORR_RESOURCE_ASSET_RULE } from './resource-asset.js';
import { CORR_ROUTE_ENTRY_RULE } from './route-entry.js';

export {
  CORR_IMAGE_ASSET_RULE,
  CORR_FONT_ASSET_RULE,
  CORR_RENDER_BLOCKING_RULE,
  CORR_SCRIPT_IMPORT_RULE,
  CORR_RESOURCE_ASSET_RULE,
  CORR_ROUTE_ENTRY_RULE
};

export const DEFAULT_CORRELATION_RULES: readonly CorrelationRule[] = [
  CORR_IMAGE_ASSET_RULE,
  CORR_FONT_ASSET_RULE,
  CORR_RENDER_BLOCKING_RULE,
  CORR_SCRIPT_IMPORT_RULE,
  CORR_RESOURCE_ASSET_RULE,
  CORR_ROUTE_ENTRY_RULE
];
