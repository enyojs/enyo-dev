'use strict';

var logger = require('./lib/logger');
// var winston = require('winston');

// winston.cli();
// winston.log('info', 'test %s', 'info');

logger.setLogLevel('error');
logger.log('info', 'this is info');
logger.log('debug', 'this is debug');
logger.log('error', 'this is error');