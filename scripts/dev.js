// Local dev runner: sets BASE_PATH=/, syncs from Sanity, starts watcher and local server
try { require('dotenv').config() } catch {}
process.env.BASE_PATH = '/'

const { spawn } = require('node:child_process')

function run(cmd, args, opts={}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts })
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)))
  })
}

(async function main(){
  try {
    await run('node', ['scripts/fetch-sanity.js'])
  } catch (e) {
    console.warn('Sync failed (continuing to watch):', e.message)
  }
  // start renderer watcher
  spawn('node', ['scripts/render-pages.js', '--watch'], { stdio: 'inherit' })
  // start local server
  spawn('node', ['scripts/serve.js'], { stdio: 'inherit' })
})()

