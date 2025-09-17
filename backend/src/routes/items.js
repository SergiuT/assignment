const express = require('express');
const fsp = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDataPath } = require('../utils/dataPath');
const router = express.Router();

/**
 * Module-level cache object. Structure chosen for clarity and future extension.
 */
const itemsCache = {
  items: null, // Array of items or null before first load
  loadingPromise: null, // Promise representing an in-flight load, used to de-duplicate concurrent loads
  writeChain: Promise.resolve(), // Promise chain for serializing writes to the file
  dataPath: null // Absolute path that current cache corresponds to
};

/**
 * Safely parses JSON and throws a descriptive error on failure.
 */
function parseJson(bufferOrString) {
  try {
    return JSON.parse(bufferOrString);
  } catch (error) {
    const parseError = new Error('Failed to parse items data file as JSON');
    parseError.cause = error;
    parseError.status = 500;
    throw parseError;
  }
}

/**
 * Loads items from disk into the cache using non-blocking I/O.
 * Uses a single shared promise to coalesce concurrent load requests.
 */
async function loadItemsIntoCache() {
  const pathNow = getDataPath();
  // Invalidate cache if data file mtime changed
  try {
    const stat = await fsp.stat(pathNow);
    if (itemsCache.items && itemsCache.dataPath === pathNow && itemsCache.mtimeMs === stat.mtimeMs) {
      return itemsCache.items;
    }
  } catch (e) {
    // fall back to reload below
  }
  if (itemsCache.loadingPromise) {
    return itemsCache.loadingPromise;
  }
  itemsCache.loadingPromise = (async () => {
    const raw = await fsp.readFile(pathNow, 'utf8');
    const parsed = parseJson(raw);
    // Precompute a lowercase name for faster case-insensitive substring search
    const normalized = Array.isArray(parsed)
      ? parsed.map(item => ({ ...item, _nameLower: typeof item.name === 'string' ? item.name.toLowerCase() : '' }))
      : [];
    // capture file mtime for invalidation
    const stat = await fsp.stat(pathNow);
    itemsCache.items = normalized;
    itemsCache.loadingPromise = null;
    itemsCache.dataPath = pathNow;
    itemsCache.mtimeMs = stat.mtimeMs;
    return itemsCache.items;
  })();
  return itemsCache.loadingPromise;
}

/**
 * Persists the current cache to disk in a write-serialized manner.
 * Ensures writes do not interleave by chaining onto the prior write promise.
 */
function persistCacheToDisk() {
  itemsCache.writeChain = itemsCache.writeChain.then(async () => {
    const toWrite = JSON.stringify(
      // Remove helper field before writing to disk
      (itemsCache.items || []).map(({ _nameLower, ...rest }) => rest),
      null,
      2
    );
    const pathForWrite = itemsCache.dataPath || getDataPath();
    await fsp.writeFile(pathForWrite, toWrite, 'utf8');
  });
  return itemsCache.writeChain;
}

/**
 * Express helper to handle async route errors without repeating try/catch.
 */
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// GET /api/items
router.get('/', asyncHandler(async (req, res) => {
  const data = await loadItemsIntoCache();
  const { limit, offset, q } = req.query;
  let results = data;

  if (q) {
    const qLower = String(q).toLowerCase();
    // Use precomputed lowercase index for faster case-insensitive search
    results = results.filter(item => item._nameLower.includes(qLower));
  }

  const total = results.length;
  let start = 0;
  let end = total;
  if (offset !== undefined) {
    const safeOffset = Number.parseInt(String(offset), 10);
    if (!Number.isNaN(safeOffset) && safeOffset >= 0) {
      start = Math.min(safeOffset, total);
    }
  }
  if (limit !== undefined) {
    const safeLimit = Number.parseInt(String(limit), 10);
    if (!Number.isNaN(safeLimit) && safeLimit >= 0) {
      end = Math.min(start + safeLimit, total);
    }
  }
  const paged = results.slice(start, end);

  res.set('X-Total-Count', String(total)).json(
    // Strip helper field from responses
    paged.map(({ _nameLower, ...rest }) => rest)
  );
}));

// GET /api/items/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const data = await loadItemsIntoCache();
  const id = Number.parseInt(req.params.id, 10);
  const item = data.find(i => i.id === id);
  if (!item) {
    const err = new Error('Item not found');
    err.status = 404;
    throw err;
  }
  const { _nameLower, ...rest } = item;
  res.json(rest);
}));

// POST /api/items
router.post('/', asyncHandler(async (req, res) => {
  // Minimal payload validation for performance and clarity
  const payload = req.body || {};
  if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
    const err = new Error('Invalid payload: "name" is required');
    err.status = 400;
    throw err;
  }

  const data = await loadItemsIntoCache();
  const newItem = {
    id: uuidv4(),
    name: payload.name,
    ...payload
  };
  // Maintain helper index field in cache
  const cachedItem = { ...newItem, _nameLower: newItem.name.toLowerCase() };
  itemsCache.items = [...data, cachedItem];

  await persistCacheToDisk();
  const { _nameLower, ...responseItem } = cachedItem;
  res.status(201).json(responseItem);
}));

module.exports = router;