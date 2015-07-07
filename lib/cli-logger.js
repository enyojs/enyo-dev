'use strict';

/**
* This utility is a stop-gap hack and is completely temporary. It is used most immediately for a
* few utilities that require the ability to report information to the console regardless of the
* current log-level and without the need to be piped to bunyan.
*/

var
	winston = require('winston');

var
	cli = new winston.Logger({
		transports: [
			new (winston.transports.Console)({showLevel: false, colorize: true})
		]
	});

module.exports = function () {
	return cli.info.apply(cli, arguments);
};