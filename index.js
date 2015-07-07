'use strict';

var
	Packager = require('./lib/Packager'),
	Watcher = require('./lib/Watcher'),
	Server = require('./lib/Server');

/**
* Package an Enyo 2.6+ application based on the provided options.
*/
exports.package = function (opts) {
	opts = opts || {};
	if (opts.watch) return new Watcher(opts);
	else return new Packager(opts).run();
};

/**
* Begin serving an automatically rebuilt Enyo 2.6+ application based on the provided options.
*/
exports.serve = function (opts) {
	opts = opts || {};
	return new Server(opts).run();
};