// Loopback bind for the render-probe test servers.
//
// The Workers Elves macOS host sandbox permits loopback binds only inside the
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
