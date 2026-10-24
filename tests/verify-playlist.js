const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTest() {
  const playlistPath = path.join(__dirname, '..', 'data', 'playlist.json');
  assert.ok(fs.existsSync(playlistPath), 'data/playlist.json must exist');

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

  console.log('✅ All playlist assertions passed!');
}

runTest();
