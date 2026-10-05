import { mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs'
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
// one. An explicit PLAYWRIGHT_BROWSERS_PATH or a populated default registry is
// always left untouched — this only repairs the bare `npm test` case.
//
// The resolution runs at MODULE-EVALUATION time (and this module must be
// imported before 'playwright'): the Playwright registry reads
// PLAYWRIGHT_BROWSERS_PATH when the module is first imported, so an env var
// set later in the same process is ignored.
//
// If NO known cache holds a chromium install (a fresh container that has never
// prepared one), the browsers are installed ONCE into the repo-local
// `.cache/ms-playwright` directory so every later bare `npm test` — including
// in fresh clones/containers with no prepared cache — finds an executable.
// The install runs under an exclusive lock directory so concurrent node --test
// workers don't race; a registry without a chromium entry is treated as absent.
const FALLBACK_BROWSER_ROOTS = [
  join(dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'ms-playwright'),
  '/state/cache/pw-browsers'
]
const REPO_BROWSER_ROOT = FALLBACK_BROWSER_ROOTS[0]

// A chromium directory exists only when its INSTALLATION_COMPLETE marker is
// present: Playwright creates the browser directory BEFORE extracting the
// archive and writes the marker only after the install finishes, so a bare
// directory listing would report a half-extracted install as ready (a cold
// cache with several node --test workers racing the one installer).
const hasChromium = (root) => {
  try {
    for (const d of readdirSync(root)) {
      if (d.startsWith('chromium') && existsSync(join(root, d, 'INSTALLATION_COMPLETE'))) return true
    }
    return false
  } catch {
    return false
  }
}

if (!process.env.PLAYWRIGHT_BROWSERS_PATH &&
    !hasChromium(join(homedir(), '.cache', 'ms-playwright'))) {
  let resolved = null
  for (const root of FALLBACK_BROWSER_ROOTS) {
    if (existsSync(root) && hasChromium(root)) {
      resolved = root
      break
    }
  }
  if (resolved === null) {
    installRepoLocalBrowsers()
    // The install targets the repo-local root; point the registry there even
    // when the install is owned by another concurrent worker still in flight —
    // the launching test then fails loudly with the exact missing path instead
    // of silently probing an unprepared default registry.
    process.env.PLAYWRIGHT_BROWSERS_PATH = REPO_BROWSER_ROOT
  } else {
    process.env.PLAYWRIGHT_BROWSERS_PATH = resolved
  }
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

export const ensurePlaywrightBrowsersPath = () => {}
