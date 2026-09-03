// Windows fallback for environments that cannot create child-process pipes.
// Uses the installed esbuild CLI with inherited stdio; no dependency/version changes.
import { spawnSync } from 'node:child_process'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { loadEnv } from 'vite'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const platform = process.platform === 'win32' ? '@esbuild/win32-x64/esbuild.exe' : process.platform === 'darwin' ? '@esbuild/darwin-' + process.arch + '/bin/esbuild' : '@esbuild/linux-' + process.arch + '/bin/esbuild'
const binary = require.resolve(platform)
const output = resolve(root, 'dist')
const metadata = resolve(root, 'dist/portable-build.json')
const environment = loadEnv('production', root, 'VITE_')
await mkdir(output, { recursive: true })
const child = spawnSync(binary, [
  'src/main.jsx', '--bundle', '--format=esm', '--platform=browser', '--target=es2020',
  '--jsx=automatic', '--minify', '--external:/valid-tree-logo.png', '--entry-names=assets/[name]-[hash]', '--asset-names=assets/[name]-[hash]',
  '--outdir=dist', '--metafile=' + metadata,
  '--define:process.env.NODE_ENV="production"',
  '--define:import.meta.env=' + JSON.stringify({ ...environment, MODE: 'production', PROD: true, DEV: false, BASE_URL: '/' }),
], { cwd: root, stdio: 'inherit' })
if (child.error || child.status !== 0) throw child.error || new Error('Portable build failed: ' + child.status)
const meta = JSON.parse(await readFile(metadata, 'utf8'))
const [entry, info] = Object.entries(meta.outputs).find(([, item]) => item.entryPoint === 'src/main.jsx')
if (!entry || !info.cssBundle) throw new Error('Build is missing its JavaScript or stylesheet.')
await cp(resolve(root, 'public'), output, { recursive: true })
const html = (await readFile(resolve(root, 'index.html'), 'utf8'))
  .replace('<script type="module" src="/src/main.jsx"></script>', '<script type="module" crossorigin src="/' + relative(output, resolve(root, entry)).replaceAll('\\', '/') + '"></script>\n    <link rel="stylesheet" crossorigin href="/' + relative(output, resolve(root, info.cssBundle)).replaceAll('\\', '/') + '">')
await writeFile(resolve(output, 'index.html'), html)
console.log('Portable production build complete; existing Vite build remains available.')
