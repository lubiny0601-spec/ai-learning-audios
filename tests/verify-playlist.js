const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTest() {
  const playlistPath = path.join(__dirname, '..', 'data', 'playlist.json');
  const booksPath = path.join(__dirname, '..', 'data', 'books.json');
  assert.ok(fs.existsSync(playlistPath), 'data/playlist.json must exist');
  assert.ok(fs.existsSync(booksPath), 'data/books.json must exist');

  const content = JSON.parse(fs.readFileSync(playlistPath, 'utf8'));
  assert.ok(Array.isArray(content), 'playlist.json must be an array');
  assert.strictEqual(content.length, 13, 'playlist must contain exactly 13 audio items');

  content.forEach((item, idx) => {
    assert.ok(item.id, `item ${idx} must have id`);
    assert.ok(item.filename, `item ${idx} must have filename`);
    assert.ok(item.title, `item ${idx} must have title`);
    assert.ok(item.url, `item ${idx} must have url`);
    assert.ok(typeof item.size === 'number' && item.size > 0, `item ${idx} must have valid size`);
    assert.ok(item.sizeFormatted, `item ${idx} must have formatted size string`);
  });

  const books = JSON.parse(fs.readFileSync(booksPath, 'utf8'));
  assert.ok(Array.isArray(books), 'books.json must be an array');
  assert.strictEqual(books.length, 13, 'books must contain 13 PDF items');

  // 验证第01章音频关联了第01章讲义
  const item01 = content.find(c => c.order === 1);
  assert.ok(item01.pdfUrl, 'order 1 must have matched pdfUrl');
  assert.ok(item01.pdfUrl.includes('%E7%AC%AC01%E7%AB%A0'), 'order 1 must link to chapter 1 pdf');

  console.log('✅ All playlist and books assertions passed!');
}

runTest();
