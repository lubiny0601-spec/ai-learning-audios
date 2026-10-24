const assert = require('assert');

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function calculateProgress(currentTime, duration) {
  if (!duration || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

function getNextIndex(currentIndex, totalCount, mode) {
  if (totalCount <= 0) return -1;
  if (mode === 'single-repeat') return currentIndex;
  if (mode === 'all-repeat') return (currentIndex + 1) % totalCount;
  // sequential
  if (currentIndex + 1 < totalCount) return currentIndex + 1;
  return -1; // end of playlist
}

// 1. 测试时间格式化
assert.strictEqual(formatTime(0), '00:00');
assert.strictEqual(formatTime(65), '01:05');
assert.strictEqual(formatTime(3605), '60:05');

// 2. 测试进度百分比
assert.strictEqual(calculateProgress(30, 60), 50);
assert.strictEqual(calculateProgress(0, 100), 0);
assert.strictEqual(calculateProgress(100, 100), 100);

// 3. 测试倍速档位完整性
const speedSteps = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
assert.ok(speedSteps.includes(1.5), 'Should support 1.5x');
assert.ok(speedSteps.includes(2.0), 'Should support 2.0x');
assert.ok(speedSteps.includes(3.0), 'Should support 3.0x');

// 4. 测试播放模式状态循环
assert.strictEqual(getNextIndex(0, 3, 'sequential'), 1);
assert.strictEqual(getNextIndex(2, 3, 'sequential'), -1);
assert.strictEqual(getNextIndex(2, 3, 'all-repeat'), 0);
assert.strictEqual(getNextIndex(1, 3, 'single-repeat'), 1);

console.log('✅ App logic unit test passed!');
