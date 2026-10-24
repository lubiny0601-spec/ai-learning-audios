const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 创建一个轻量 HTTP 服务模拟本地与 Pages 静态响应
const server = http.createServer((req, res) => {
  const reqUrl = decodeURI(req.url.split('?')[0]);
  let filePath = path.join(__dirname, '..', reqUrl === '/' ? 'index.html' : reqUrl);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const mimeMap = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.m4a': 'audio/mp4',
    '.pdf': 'application/pdf'
  };

  const contentType = mimeMap[ext] || 'application/octet-stream';

  const range = req.headers.range;
  if (range && ext === '.m4a') {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 512, stat.size - 1);
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

server.listen(4568, async () => {
  console.log('Test server started on port 4568');

  try {
    // 1. 测试主页
    const resHome = await fetch('http://localhost:4568/');
    assert.strictEqual(resHome.status, 200, 'Home page must return 200');
    const htmlText = await resHome.text();
    assert.ok(htmlText.includes('AI 学习音频'), 'Home page title must match');

    // 2. 测试 playlist.json 与 books.json
    const resPlaylist = await fetch('http://localhost:4568/data/playlist.json');
    assert.strictEqual(resPlaylist.status, 200, 'Playlist JSON must return 200');
    const playlist = await resPlaylist.json();
    assert.strictEqual(playlist.length, 13, 'Must contain 13 items');

    const resBooks = await fetch('http://localhost:4568/data/books.json');
    assert.strictEqual(resBooks.status, 200, 'Books JSON must return 200');
    const books = await resBooks.json();
    assert.strictEqual(books.length, 13, 'Must contain 13 books');

    // 3. 测试音频流式请求
    const firstAudioUrl = 'http://localhost:4568/' + playlist[0].url;
    const resAudioRange = await fetch(firstAudioUrl, {
      headers: { Range: 'bytes=0-1024' }
    });
    assert.strictEqual(resAudioRange.status, 206, 'Audio file should support 206 Partial Content');

    // 4. 测试 PDF 在线访问
    const firstBookUrl = 'http://localhost:4568/' + books[0].url;
    const resPdf = await fetch(firstBookUrl);
    assert.strictEqual(resPdf.status, 200, 'PDF book should return 200');
    assert.strictEqual(resPdf.headers.get('content-type'), 'application/pdf');

    console.log('✅ End-to-end HTTP static, audio stream & PDF tests passed successfully!');
  } catch (err) {
    console.error('E2E Test Failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
