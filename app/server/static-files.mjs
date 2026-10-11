import path from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { ApiError } from './errors.mjs';

// Use the same operation with native paths in production and win32/posix in tests.
export function isWithinRoot(root, candidate, paths = path) {
  const relative = paths.relative(paths.resolve(root), paths.resolve(candidate));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${paths.sep}`) && !paths.isAbsolute(relative);
}
export function resolvePublicFile(root, requestPath, paths = path) {
  let decoded;
  try { decoded = decodeURIComponent(requestPath); } catch { throw new ApiError('NOT_FOUND', 404); }
  // Strictly serve this build's public asset families. Reject dot segments before
  // normalization, Windows separators/drives/ADS and double-encoded components.
  if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\0:%]/.test(decoded)
      || decoded.split('/').some(part => part.startsWith('.'))) throw new ApiError('NOT_FOUND', 404);
  const asset = decoded === '/' ? '/index.html' : decoded;
  if (!/^\/(?:index\.html|styles\.css|(?:client|shared)\/[A-Za-z0-9/_-]+\.js)$/.test(asset)) throw new ApiError('NOT_FOUND', 404);
  const candidate = paths.resolve(root, `.${asset}`);
  if (!isWithinRoot(root, candidate, paths)) throw new ApiError('NOT_FOUND', 404);
  return candidate;
}
export async function readPublicFile(root, requestPath) {
  const candidate = resolvePublicFile(root, requestPath);
  try {
    // A symlink in dist must not expose a file outside the real public root.
    const [realRoot, realFile] = await Promise.all([realpath(root), realpath(candidate)]);
    if (!isWithinRoot(realRoot, realFile)) throw new ApiError('NOT_FOUND', 404);
    return { file: candidate, data: await readFile(realFile) };
  } catch { throw new ApiError('NOT_FOUND', 404); }
}
