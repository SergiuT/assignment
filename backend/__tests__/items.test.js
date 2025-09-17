const path = require('path');
const fs = require('fs');
const os = require('os');
const request = require('supertest');

function freshApp() {
  // Ensure a clean module graph so caches and DATA_PATH are re-evaluated per test
  Object.keys(require.cache)
    .filter(k => /\/backend\/src\//.test(k))
    .forEach(k => delete require.cache[k]);
  return require('../src/app');
}

// Create a temp data file per test run and point the app to it via env.
function createTempDataFile(initialItems) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'items-test-'));
  const file = path.join(tmpDir, 'items.json');
  fs.writeFileSync(file, JSON.stringify(initialItems, null, 2));
  return file;
}

describe('Items API', () => {
  test('lists items, supports q and limit', async () => {
    const tempFile = createTempDataFile([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
      { id: 3, name: 'Alphabet' }
    ]);
    process.env.ITEMS_DATA_PATH = tempFile;
    const app = freshApp();

    const resAll = await request(app).get('/api/items');
    expect(resAll.statusCode).toBe(200);
    expect(resAll.body).toHaveLength(3);

    const resQ = await request(app).get('/api/items').query({ q: 'alp' });
    expect(resQ.statusCode).toBe(200);
    // Alpha & Alphabet match
    expect(resQ.body.map(i => i.id).sort()).toEqual([1, 3]);

    const resLimit = await request(app).get('/api/items').query({ limit: 2 });
    expect(resLimit.statusCode).toBe(200);
    expect(resLimit.body).toHaveLength(2);
  });

  test('gets item by id and returns 404 when missing', async () => {
    const tempFile = createTempDataFile([{ id: 7, name: 'Gamma' }]);
    process.env.ITEMS_DATA_PATH = tempFile;
    const app = freshApp();

    const ok = await request(app).get('/api/items/7');
    expect(ok.statusCode).toBe(200);
    expect(ok.body.name).toBe('Gamma');

    const missing = await request(app).get('/api/items/999');
    expect(missing.statusCode).toBe(404);
  });

  test('creates item with minimal validation and persists to file', async () => {
    const tempFile = createTempDataFile([]);
    process.env.ITEMS_DATA_PATH = tempFile;
    const app = freshApp();

    const bad = await request(app).post('/api/items').send({});
    expect(bad.statusCode).toBe(400);

    const good = await request(app).post('/api/items').send({ name: 'Delta' });
    expect(good.statusCode).toBe(201);
    expect(good.body.name).toBe('Delta');
    expect(good.body.id).toBeDefined();

    const fileData = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    expect(fileData.some(i => i.name === 'Delta')).toBe(true);
  });
});


