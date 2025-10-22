// Minimal static server for local preview
// Serves files from project root on http://localhost:3000
const http = require('http')
const fs = require('fs')
const path = require('path')
const url = require('url')

const root = path.join(__dirname, '..')
const port = Number(process.env.PORT || 3000)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8'
}

function send(res, status, body, headers={}) {
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-cache' }, headers))
  res.end(body)
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const type = types[ext] || 'application/octet-stream'
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found')
    send(res, 200, data, { 'Content-Type': type })
  })
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url)
  let pathname = decodeURIComponent(parsed.pathname)
  if (pathname.includes('..')) return send(res, 400, 'Bad request')

  let filePath = path.join(root, pathname)
  // If path is a directory or ends with '/', serve index.html
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
      return sendFile(res, filePath)
    }
    if (pathname.endsWith('/')) {
      filePath = path.join(root, pathname, 'index.html')
      return sendFile(res, filePath)
    }
    // If file without extension and file doesn't exist, try adding '/index.html'
    if (err) {
      const withIndex = path.join(root, pathname, 'index.html')
      return sendFile(res, withIndex)
    }
    sendFile(res, filePath)
  })
})

server.listen(port, () => {
  console.log(`Local server running at http://localhost:${port}`)
})

