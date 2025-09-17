const express = require('express');
const cors = require('cors');
const itemsRouter = require('./routes/items');
const statsRouter = require('./routes/stats');
const { requestLogger } = require('./middleware/logger');

// Build the express app without starting the server.
// This allows supertest to import the app directly for fast, reliable tests.
const app = express();

app.use(cors({ origin: 'http://localhost:3000', exposedHeaders: ['X-Total-Count'] }));
app.use(express.json());

app.use(requestLogger);

app.use('/api/items', itemsRouter);
app.use('/api/stats', statsRouter);

module.exports = app;


