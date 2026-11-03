/** Restore the five CC BY user-supplied GLBs from GitHub-safe gzipped base64 parts.
 * The repo stores chunks as ordinary UTF-8 files because the connected GitHub
 * API cannot upload large binary objects in one request. Original GLB bytes
 * are restored exactly and verified by SHA-256 before any game build.
 */
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const encoded = join(root, 'assets', 'encoded');
const output = join(root, 'public', 'models');
const files = {
  'anime-girl-base.glb': '8f39a362da6a0998ff3bdffa3f2b7c0c97ea6ba164b34f86085378d88d516a5c',
  'cat-girl.glb': '79abc02a65bbe65cb9f9f0711b0e669d595dc3cde7ff3e90421476b521b28847',
  'cute-anime-girl.glb': '2924eee647956520c24759b71bc1e4b1b6b9be657c053104ca279fc612bc7fdd',
  'mei-tachibana.glb': '460dff0d2d7375f10133b86664f862329b56dc363cbd4dc4858019b74316b57a',
  'nieko.glb': '60f6d8f270d05bae4c469947d95447d713d772776a6adc8e8ab320eab6ab17a1',
};
const digest = buf => createHash('sha256').update(buf).digest('hex');
await mkdir(output, { recursive: true });
const archiveNames = existsSync(encoded) ? await readdir(encoded) : [];
for (const [name, expected] of Object.entries(files)) {
  const destination = join(output, name);
  let current = null;
  try { current = await readFile(destination); } catch { /* not present */ }
  if (current && digest(current) === expected) { console.log(`[assets] OK ${name}`); continue; }
  const chunks = archiveNames.filter(n => n.startsWith(`${name}.gz.b64.`)).sort();
  if (!chunks.length) throw Error(`[assets] Missing encoded archive for ${name}. Check that all assets/encoded/ files were cloned.`);
  const text = (await Promise.all(chunks.map(c => readFile(join(encoded, c), 'utf8')))).join('');
  const binary = gunzipSync(Buffer.from(text, 'base64'));
  if (binary.subarray(0,4).toString('ascii') !== 'glTF' || digest(binary) !== expected)
    throw Error(`[assets] Invalid, corrupted or incomplete archive for ${name}`);
  await writeFile(destination, binary);
  console.log(`[assets] Restored ${name} (${(binary.length/1024/1024).toFixed(2)} MiB)`);
}