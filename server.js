import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.substring(1));
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + filePath);
    } else {
      res.writeHead(200);
      res.end(data);
    }
  });
});

server.listen(5500, '127.0.0.1', () => {
  console.log('Server running on http://127.0.0.1:5500');
});
