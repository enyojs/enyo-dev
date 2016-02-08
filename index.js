'use strict';

require('babel-register')({
	extensions: ['.es6']
});

var   Packager = require('./lib/Packager')
	// , Watcher  = require('./lib/Watcher')
	, setup    = require('./lib/setup').default
	, exports  = module.exports;

exports.packager = function packager (opts) {
	opts = opts || {};
	let params = setup(opts);
	return opts.watch ? (new Watcher(params)) : (new Packager(params));
};

exports.watch   = function watch (opts) {
	opts = opts || {};
	return new Watcher(setup(opts));
};