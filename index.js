'use strict';

var
	Packager = require('./lib/Packager'),
	Watcher = require('./lib/Watcher'),
	Server = require('./lib/Server');

var
	setup = require('./lib/setup');

exports.package = function (opts) {
	opts = opts || {};
	return setup(opts).then(function () {
		return opts.env.get('watch');
	}).then(function (watch) {
		if (watch) return exports.watch(opts);
		else return new Packager(opts).run();
	});
};

exports.serve = function (opts) {
	opts = opts || {};
	return setup(opts).then(function (opts) {
		return new Server(opts).run();
	});
};

exports.watch = function (opts) {
	opts = opts || {};
	return setup(opts).then(function () {
		return new Watcher(opts);
	});
};