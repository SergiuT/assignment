const express = require('express');
const fsp = require('fs/promises');
const path = require('path');
const { getDataPath } = require('../utils/dataPath');
const router = express.Router();

// Cached stats with mtime-based invalidation
// ------------------------------------------
// We avoid re-reading/parsing and recomputing on every request by caching the
// computed stats along with the source file's mtime. On each request we only
// stat the file (cheap) and recompute if the mtime has changed.

const statsCache = {
  value: null,         // { total, averagePrice }
  sourceMtimeMs: null, // number | null
  computing: null      // Promise | null to coalesce concurrent recomputes
};

function parseJson(bufferOrString) {
  try {
    return JSON.parse(bufferOrString);
  } catch (error) {
    const e = new Error('Failed to parse items file while computing stats');
    e.status = 500;
    e.cause = error;
    throw e;
  }
}

function computeStats(items) {
  const total = Array.isArray(items) ? items.length : 0;
  if (total === 0) {
    return { total: 0, averagePrice: 0 };
  }
  const sum = items.reduce((acc, cur) => acc + (Number(cur.price) || 0), 0);
  return { total, averagePrice: sum / total };
}

async function loadStatsIfStale() {
  const stat = await fsp.stat(getDataPath());
  const mtimeMs = stat.mtimeMs;

  if (statsCache.value && statsCache.sourceMtimeMs === mtimeMs) {
    return statsCache.value;
  }
  if (statsCache.computing) {
    return statsCache.computing;
  }
  statsCache.computing = (async () => {
    const raw = await fsp.readFile(getDataPath(), 'utf8');
    const items = parseJson(raw);
    const value = computeStats(items);
    statsCache.value = value;
    statsCache.sourceMtimeMs = mtimeMs;
    statsCache.computing = null;
    return value;
  })();
  return statsCache.computing;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// GET /api/stats
router.get('/', asyncHandler(async (req, res) => {
  const stats = await loadStatsIfStale();
  res.json(stats);
}));

module.exports = router;