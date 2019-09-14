const bunyan = require('bunyan');

export const logger = bunyan.createLogger({
  name: 'bitbucket-pr-detector',
});

if (process.env.DEBUG_TRACE) {
  logger.level('trace');
}

export function createLogger(nodeModule: NodeModule) {
  return logger.child({
    filename: nodeModule.filename,
  });
}
