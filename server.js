const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const DIST = path.join(__dirname, 'dist');
const NS_API_KEY = '7383917274334e0dad1099b05e091088';

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.json': 'application/json',
};

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Proxy: /api/departures?station=XXX
  if (req.url.startsWith('/api/departures')) {
    const qs = req.url.split('?')[1] ?? '';
    const nsUrl = `https://gateway.apiportal.ns.nl/reisinformatie-api/api/v2/departures?${qs}`;
    const options = {
      headers: {
        'Ocp-Apim-Subscription-Key': NS_API_KEY,
        'Accept': 'application/json',
      },
    };
    https.get(nsUrl, options, (nsRes) => {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = nsRes.statusCode;
      nsRes.pipe(res);
    }).on('error', (e) => {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: e.message }));
    });
    return;
  }

  // Static files
  let filePath = path.join(DIST, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(filePath)) filePath = path.join(DIST, 'index.html');
  const ext = path.extname(filePath);
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);

}).listen(PORT, () => console.log(`train-home-app running on http://localhost:${PORT}`));
