import {
  type AssetEvidence,
  type AssetCategory,
  type FileInventoryItem
} from '../types.js';

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg', '.ico', '.bmp', '.tiff'
]);

const FONT_EXTENSIONS = new Set([
  '.woff2', '.woff', '.ttf', '.otf', '.eot'
]);

const STYLESHEET_EXTENSIONS = new Set([
  '.css', '.scss', '.sass', '.less'
]);

const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.webm', '.ogg', '.mp3', '.wav', '.m4a'
]);

const DOCUMENT_EXTENSIONS = new Set([
  '.pdf'
]);

export function extractAssets(files: readonly FileInventoryItem[]): AssetEvidence[] {
  const assets: AssetEvidence[] = [];

  for (const file of files) {
    const ext = file.extension.toLowerCase();
    let category: AssetCategory | null = null;

    if (IMAGE_EXTENSIONS.has(ext)) {
      category = 'image';
    } else if (FONT_EXTENSIONS.has(ext)) {
      category = 'font';
    } else if (STYLESHEET_EXTENSIONS.has(ext)) {
      category = 'stylesheet';
    } else if (MEDIA_EXTENSIONS.has(ext)) {
      category = 'media';
    } else if (DOCUMENT_EXTENSIONS.has(ext)) {
      category = 'document';
    } else if (
      (file.relativePath.startsWith('public/') || file.relativePath.startsWith('assets/')) &&
      (ext === '.js' || ext === '.mjs')
    ) {
      category = 'script';
    }

    if (category) {
      assets.push({
        relativePath: file.relativePath,
        extension: ext,
        category,
        sizeBytes: file.sizeBytes
      });
    }
  }

  assets.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return assets;
}
