'use strict';

require('babel-register')({
	extensions: ['.es6'],
	only: /enyo-dev\/(?!(node_modules))/
});

var	EventEmitter = require('events').EventEmitter,
	Packager = require('./lib/Packager')
	, Watcher  = require('./lib/Watcher').default
	, setup    = require('./lib/setup').default
	, exports  = module.exports;

exports.packager = function packager (opts) {
	opts = opts || {};
	var params = setup(opts);
	if(opts.watch) {
		return new Watcher(params);
	} else {
		var emitter = new EventEmitter();
		var pkgs = opts.subpackage || [];
		pkgs.unshift({options:opts});
		var cwd = process.cwd();
		var next = function() {
			if(pkgs.length>0) {
				var curr = pkgs.shift();
				if(curr.name) {
					emitter.emit('subpackage', curr);
				}
				process.chdir(curr.name || '.');
				var params = setup(curr.options);
				var build = (new Packager(params)).run();
				process.chdir(cwd);
				build.once('end', next);
			} else {
				emitter.emit('end')
			}
		};
		next();
		return emitter;
	}
};

exports.watch = function watch (opts) {
	opts = opts || {};
	return new Watcher(setup(opts));
};