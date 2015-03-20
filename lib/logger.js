'use strict';

var
	winston = require('winston');

var
	logger = new (winston.Logger)({
		transports: [
			new (winston.transports.Console)({
				handleExceptions: true,
				prettyPrint: true,
				colorize: true,
				debugStdout: true
			})
		],
		exitOnError: true
	});

logger.cli();

// add this for convenience
logger.setLogLevel = function (level) {
	this.transports.console.level = level;
};

module.exports = logger;