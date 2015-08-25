'use strict';

var
	Promise = require('bluebird');

var
	bunyan = require('bunyan'),
	log = bunyan.createLogger({name: 'enyo-dev'});

module.exports = log;

Promise.onPossiblyUnhandledRejection(function (e) {
	throw e;
});

process.on('uncaughtException', function (err) {
	log.fatal(err);
	process.exit(1);
});