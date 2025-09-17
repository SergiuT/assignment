const pino = require('pino');
const pinoHttp = require('pino-http');

// Configure base logger
const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport: process.env.NODE_ENV === 'production' ? undefined : {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
    remove: true
  }
});

// Request logger middleware with request ID
const requestLogger = pinoHttp({
  logger,
  useLevel: 'info',
  genReqId: (req, res) => req.headers['x-request-id'] || Math.random().toString(36).slice(2),
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        headers: req.headers
      };
    }
  }
});

module.exports = { logger, requestLogger };