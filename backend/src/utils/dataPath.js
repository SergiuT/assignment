const path = require('path');

// Resolve data path at call-time so tests can swap files reliably within one process
function getDataPath() {
  return process.env.ITEMS_DATA_PATH || path.join(__dirname, '../../../data/items.json');
}

module.exports = { getDataPath };


