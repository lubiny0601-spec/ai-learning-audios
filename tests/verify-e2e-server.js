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
    '.m4a': 'audio/mp4'
  };

  const contentType = mimeMap[ext] || 'application/octet-stream';

  // 模拟支持 HTTP Range 请求（用于流式播放）
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

server.listen(4567, async () => {
  console.log('Test server started on port 4567');

  try {
    // 1. 测试主页
    const resHome = await fetch('http://localhost:4567/');
    assert.strictEqual(resHome.status, 200, 'Home page must return 200');
    const htmlText = await resHome.text();
    assert.ok(htmlText.includes('AI 学习音频库'), 'Home page title must match');

    // 2. 测试 playlist.json
    const resPlaylist = await fetch('http://localhost:4567/data/playlist.json');
    assert.strictEqual(resPlaylist.status, 200, 'Playlist JSON must return 200');
    const playlist = await resPlaylist.json();
    assert.strictEqual(playlist.length, 13, 'Must contain 13 items');

    // 3. 测试第一个音频文件的 HTTP 访问与流式缓冲 Range
    const firstAudioUrl = 'http://localhost:4567/' + playlist[0].url;
    const resAudioRange = await fetch(firstAudioUrl, {
      headers: { Range: 'bytes=0-1024' }
    });
    assert.strictEqual(resAudioRange.status, 206, 'Audio file should support 206 Partial Content');
    const buf = await resAudioRange.arrayBuffer();
    assert.strictEqual(buf.byteLength, 1025, 'Should return requested byte range');

    console.log('✅ End-to-end HTTP static & stream tests passed successfully!');
  } catch (err) {
    console.error('E2E Test Failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
