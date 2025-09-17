const path = require('path');
const fs = require('fs');
const os = require('os');
const request = require('supertest');

function createTempDataFile(initialItems) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-test-'));
  const file = path.join(tmpDir, 'items.json');
  fs.writeFileSync(file, JSON.stringify(initialItems, null, 2));
  return file;
}

function freshApp() {
  Object.keys(require.cache)
    .filter(k => /\/backend\/src\//.test(k))
    .forEach(k => delete require.cache[k]);
  return require('../src/app');
}

describe('Stats API', () => {
  test('computes and caches stats; invalidates on file change', async () => {
    const tempFile = createTempDataFile([
      { id: 1, name: 'A', price: 10 },
      { id: 2, name: 'B', price: 20 }
    ]);
    process.env.ITEMS_DATA_PATH = tempFile;
    const app = freshApp();

    const first = await request(app).get('/api/stats');
    expect(first.statusCode).toBe(200);
    expect(first.body).toEqual({ total: 2, averagePrice: 15 });

    // Update file (simulate another writer) and ensure mtime changes
    await new Promise(r => setTimeout(r, 5));
    fs.writeFileSync(tempFile, JSON.stringify([
      { id: 1, name: 'A', price: 10 },
      { id: 2, name: 'B', price: 20 },
      { id: 3, name: 'C', price: 40 }
    ], null, 2));

    const second = await request(app).get('/api/stats');
    expect(second.statusCode).toBe(200);
    expect(second.body).toEqual({ total: 3, averagePrice: (10 + 20 + 40) / 3 });
  });

  test('handles empty data file gracefully', async () => {
    const tempFile = createTempDataFile([]);
    process.env.ITEMS_DATA_PATH = tempFile;
    const app = freshApp();
    const res = await request(app).get('/api/stats');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ total: 0, averagePrice: 0 });
  });
});


