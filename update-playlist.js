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
  const booksDir = path.join(__dirname, 'books');
  const dataDir = path.join(__dirname, 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 1. 扫描书籍库
  let books = [];
  if (fs.existsSync(booksDir)) {
    const bookFiles = fs.readdirSync(booksDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    books = bookFiles.map((filename, idx) => {
      const filePath = path.join(booksDir, filename);
      const stat = fs.statSync(filePath);
      const isGeneral = filename.startsWith('总');
      const order = parseOrder(filename);

      return {
        id: `book-${String(idx + 1).padStart(2, '0')}`,
        filename,
        title: filename.replace(/\.pdf$/i, ''),
        url: `books/${encodeURIComponent(filename)}`,
        size: stat.size,
        sizeFormatted: formatBytes(stat.size),
        isGeneral,
        order
      };
    });

    // 排序：总教程置顶，其余按章节排序
    books.sort((a, b) => {
      if (a.isGeneral && !b.isGeneral) return -1;
      if (!a.isGeneral && b.isGeneral) return 1;
      if (a.order !== b.order) return a.order - b.order;
      return a.title.localeCompare(b.title, 'zh-CN');
    });

    fs.writeFileSync(path.join(dataDir, 'books.json'), JSON.stringify(books, null, 2), 'utf8');
    console.log(`Successfully generated books.json with ${books.length} books.`);
  }

  // 2. 扫描音频库并智能关联书籍
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

    // 匹配配套 PDF
    let matchedPdf = null;
    if (books.length > 0) {
      if (order < 100) {
        // 按章节数字匹配（如 第01章）
        const padOrder = String(order).padStart(2, '0');
        matchedPdf = books.find(b => b.filename.includes(`第${padOrder}章`));
      }
      // Agent 专题匹配
      if (!matchedPdf && (filename.includes('Agent') || filename.includes('智能体'))) {
        matchedPdf = books.find(b => b.filename.includes('Agent 实战营'));
      }
    }

    return {
      id: `audio-${String(index + 1).padStart(2, '0')}`,
      filename,
      title,
      url: `audio/${encodeURIComponent(filename)}`,
      size: stat.size,
      sizeFormatted: formatBytes(stat.size),
      order,
      pdfUrl: matchedPdf ? matchedPdf.url : null,
      pdfTitle: matchedPdf ? matchedPdf.title : null,
      pdfSizeFormatted: matchedPdf ? matchedPdf.sizeFormatted : null
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
  console.log(`Successfully generated playlist.json with ${items.length} audios and matched PDFs.`);
}

generatePlaylist();
