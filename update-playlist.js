const fs = require('fs');
const path = require('path');

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function parseOrder(filename) {
  const numMatch = filename.match(/^(\d+)\./);
  if (numMatch) return parseInt(numMatch[1], 10);
  const chMatch = filename.match(/^第(\d+)章/);
  if (chMatch) return parseInt(chMatch[1], 10);
  return 100;
}

function generatePlaylist() {
  const audioDir = path.join(__dirname, 'audio');
  const dataDir = path.join(__dirname, 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(audioDir)) {
    console.error('audio directory does not exist.');
    process.exit(1);
  }

  const files = fs.readdirSync(audioDir).filter(file => file.toLowerCase().endsWith('.m4a'));

  const items = files.map((filename, index) => {
    const filePath = path.join(audioDir, filename);
    const stat = fs.statSync(filePath);
    const title = filename.replace(/\.m4a$/i, '');
    const order = parseOrder(filename);

    return {
      id: `audio-${String(index + 1).padStart(2, '0')}`,
      filename,
      title,
      url: `audio/${encodeURIComponent(filename)}`,
      size: stat.size,
      sizeFormatted: formatBytes(stat.size),
      order
    };
  });

  items.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title, 'zh-CN');
  });

  items.forEach((item, idx) => {
    item.id = `audio-${String(idx + 1).padStart(2, '0')}`;
  });

  const outputPath = path.join(dataDir, 'playlist.json');
  fs.writeFileSync(outputPath, JSON.stringify(items, null, 2), 'utf8');
  console.log(`Successfully generated playlist.json with ${items.length} audios.`);
}

generatePlaylist();
