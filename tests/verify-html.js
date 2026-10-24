const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTest() {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const cssPath = path.join(__dirname, '..', 'styles.css');
  assert.ok(fs.existsSync(htmlPath), 'index.html must exist');
  assert.ok(fs.existsSync(cssPath), 'styles.css must exist');

  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('id="searchInput"'), 'Must have search input');
  assert.ok(html.includes('id="playlistContainer"'), 'Must have playlist container');
  assert.ok(html.includes('id="audioPlayer"'), 'Must have audio element');
  assert.ok(html.includes('id="playPauseBtn"'), 'Must have play/pause button');
  assert.ok(html.includes('id="speedSelector"'), 'Must have speed selector');
  assert.ok(html.includes('id="rewindBtn"'), 'Must have rewind -15s button');
  assert.ok(html.includes('id="forwardBtn"'), 'Must have forward +15s button');
  assert.ok(html.includes('id="progressBar"'), 'Must have progress bar');
  assert.ok(html.includes('id="sleepTimerBtn"'), 'Must have sleep timer');

  console.log('✅ HTML structure verification passed!');
}

runTest();
