const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const DIST = path.join(__dirname, 'dist');
const NS_API_KEY = process.env.NS_API_KEY || '7383917274334e0dad1099b05e091088';

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.json': 'application/json',
};

function nsGet(path, res) {
  const nsUrl = `https://gateway.apiportal.ns.nl/reisinformatie-api${path}`;
  console.log('NS →', nsUrl);
  const options = { headers: { 'Ocp-Apim-Subscription-Key': NS_API_KEY, 'Accept': 'application/json' } };
  https.get(nsUrl, options, (nsRes) => {
    console.log('NS status:', nsRes.statusCode);
    let body = '';
    nsRes.on('data', d => body += d);
    nsRes.on('end', () => {
      if (nsRes.statusCode !== 200) console.log('NS error:', body.slice(0, 200));
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = nsRes.statusCode;
      res.end(body);
    });
  }).on('error', (e) => {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: e.message }));
  });
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Proxy: /api/trips?fromStation=XXX&toStation=YYY&dateTime=...
  if (req.url.startsWith('/api/trips')) {
    const qs = req.url.split('?')[1] ?? '';
    nsGet(`/api/v3/trips?${qs}`, res);
    return;
  }

  // Static files — only fall back to index.html for navigation requests, not assets
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(filePath);
  if (!fs.existsSync(filePath)) {
    // Asset (js/css/ico) that doesn't exist → 404, not a silent HTML fallback
    if (ext && ext !== '.html') {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    filePath = path.join(DIST, 'index.html');
  }
  // Inject apple-touch-icon meta into HTML responses
  if (ext === '.html' || filePath.endsWith('index.html')) {
    let html = fs.readFileSync(filePath, 'utf8');
    if (!html.includes('apple-touch-icon')) {
      html = html.replace('</head>', '<link rel="apple-touch-icon" sizes="180x180" href="/assets/icon.png"><meta name="apple-mobile-web-app-title" content="Trein thuis"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"></head>');
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(html);
    return;
  }
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);

}).listen(PORT, () => console.log(`train-home-app running on http://localhost:${PORT}`));
