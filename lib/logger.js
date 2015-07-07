'use strict';

var
	bunyan = require('bunyan'),
	log = bunyan.createLogger({name: 'enyo-dev'});

module.exports = log;

process.on('uncaughtException', function (err) {
	log.fatal(err);
	process.exit(-1);
});