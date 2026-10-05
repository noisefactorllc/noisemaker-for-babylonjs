import { mkdirSync, existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve a Playwright chromium install for the headless engine tests.
//
// Playwright resolves its browser registry from PLAYWRIGHT_BROWSERS_PATH or the
// default ~/.cache/ms-playwright. In the Worker Elves containers HOME sits on a
// noexec tmpfs, so a browser downloaded to the default path cannot be executed
// (launch fails with EACCES / "Executable doesn't exist"), and prepared
// environments keep the browsers on an exec-mounted cache instead. When the
// caller left PLAYWRIGHT_BROWSERS_PATH unset AND the default registry holds no
// chromium install, point it at the first known exec-mounted cache that has
// one. A registry that can serve the required build is always left untouched —
// this only repairs the bare `npm test` case.
//
// Registry readiness is checked per BUILD: a registry that holds a chromium
// build other than the one the installed playwright-core launches (its
// browsers.json names the required chromium-headless-shell revision) cannot
// serve it — launch fails hard with "Executable doesn't exist". This covers
// prepared registries kept in step with a different playwright version (the
// macOS host's native browsers cache, for example) and stale repo-local
// caches left by a previous pin. When NO candidate registry — including an
// explicitly configured one — holds the required build, the browsers are
// installed ONCE into the repo-local `.cache/ms-playwright` directory so
// every later bare `npm test` — including in fresh clones/containers with no
// prepared cache — finds an executable. The install runs under an exclusive
// lock directory so concurrent node --test workers don't race.
//
// The resolution runs at MODULE-EVALUATION time (and this module must be
// imported before 'playwright'): the Playwright registry reads
// PLAYWRIGHT_BROWSERS_PATH when the module is first imported, so an env var
// set later in the same process is ignored.
const FALLBACK_BROWSER_ROOTS = [
  join(dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'ms-playwright'),
  '/state/cache/pw-browsers'
]
const REPO_BROWSER_ROOT = FALLBACK_BROWSER_ROOTS[0]

// The exact browser build the installed playwright-core launches: its
// browsers.json names the chromium-headless-shell revision. Unknown (no
// node_modules yet, unexpected layout) falls back to the historical
// any-chromium-directory readiness check.
const requiredRevision = (() => {
  try {
    const manifest = JSON.parse(readFileSync(
      join(dirname(dirname(fileURLToPath(import.meta.url))), 'node_modules', 'playwright-core', 'browsers.json'),
      'utf8'))
    const shell = manifest.browsers.find(b => b.name === 'chromium-headless-shell') ||
      manifest.browsers.find(b => b.name === 'chromium')
    return shell ? String(shell.revision) : null
  } catch {
    return null
  }
})()

const headlessShellDir = requiredRevision === null ? null : `chromium_headless_shell-${requiredRevision}`

// A chromium directory exists only when its INSTALLATION_COMPLETE marker is
// present: Playwright creates the browser directory BEFORE extracting the
// archive and writes the marker only after the install finishes, so a bare
// directory listing would report a half-extracted install as ready (a cold
// cache with several node --test workers racing the one installer).
const hasChromium = (root) => {
  try {
    if (headlessShellDir !== null) {
      return existsSync(join(root, headlessShellDir, 'INSTALLATION_COMPLETE'))
    }
    for (const d of readdirSync(root)) {
      if (d.startsWith('chromium') && existsSync(join(root, d, 'INSTALLATION_COMPLETE'))) return true
    }
    return false
  } catch {
    return false
  }
}

const candidateRoots = [
  process.env.PLAYWRIGHT_BROWSERS_PATH,
  join(homedir(), '.cache', 'ms-playwright'),
  ...FALLBACK_BROWSER_ROOTS
].filter(Boolean)
const usableRoot = candidateRoots.find(root => existsSync(root) && hasChromium(root))
if (usableRoot) {
  // Leave a registry that can serve the required build untouched; adopt the
  // first usable fallback when the default registry holds nothing usable.
  if (usableRoot !== process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = usableRoot
  }
} else {
  installRepoLocalBrowsers()
  // The install targets the repo-local root; point the registry there even
  // when the install is owned by another concurrent worker still in flight —
  // the launching test then fails loudly with the exact missing path instead
  // of silently probing an unprepared default registry.
  process.env.PLAYWRIGHT_BROWSERS_PATH = REPO_BROWSER_ROOT
}

function installRepoLocalBrowsers () {
  mkdirSync(REPO_BROWSER_ROOT, { recursive: true })
  const lock = join(REPO_BROWSER_ROOT, '.install.lock')
  // Concurrent node --test workers all hit this path in a fresh environment:
  // one installs (up to 10 min), the others wait for the registry to appear
  // (or for the lock to be abandoned, in which case they take over).
  const deadline = Date.now() + 600000
  while (Date.now() < deadline) {
    if (hasChromium(REPO_BROWSER_ROOT)) return
    let locked = false
    try {
      mkdirSync(lock)
      locked = true
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
    }
    if (locked) {
      try {
        if (!hasChromium(REPO_BROWSER_ROOT)) {
          execFileSync('npx', ['playwright', 'install', 'chromium'], {
            cwd: dirname(dirname(fileURLToPath(import.meta.url))),
            stdio: 'inherit',
            env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: REPO_BROWSER_ROOT },
            timeout: 600000
          })
        }
        return
      } finally {
        rmSync(lock, { recursive: true, force: true })
      }
    }
    // Lock held by another worker: wait for its registry, and steal the lock
    // if its holder is evidently gone (mtime older than the install timeout).
    try {
      if (Date.now() - statSync(lock).mtimeMs > 660000) rmSync(lock, { recursive: true, force: true })
    } catch { /* vanished between mkdir and stat — retry */ }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000)
  }
}

// The Worker Elves macOS host sandbox permits loopback binds only inside the
// 43117-43126 window — an ephemeral bind there fails with `listen EPERM` —
// while CI runners and dev containers allow any ephemeral port. Try an
// ephemeral bind first, then fall back to the sanctioned window on
// EPERM/EADDRINUSE, so the same render probes run unchanged in both.
const SANCTIONED_LOOPBACK_WINDOW = [43117, 43126]

export async function listenOnAvailablePort (server, host = '127.0.0.1') {
  const attempts = [0]
  for (let port = SANCTIONED_LOOPBACK_WINDOW[0]; port <= SANCTIONED_LOOPBACK_WINDOW[1]; port++) attempts.push(port)
  let lastError = null
  for (const port of attempts) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (e) => reject(e)
        server.once('error', onError)
        server.listen(port, host, () => {
          server.removeListener('error', onError)
          resolve()
        })
      })
      return server.address().port
    } catch (e) {
      lastError = e
      if (e.code !== 'EPERM' && e.code !== 'EADDRINUSE') throw e
    }
  }
  throw lastError
}

export const ensurePlaywrightBrowsersPath = () => {}
