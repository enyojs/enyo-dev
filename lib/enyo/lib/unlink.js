'use strict';

var
	path = require('path'),
	util = require('util');

var
	Promise = require('bluebird');

var
	fs = Promise.promisifyAll(require('fs'));

var reject = function () {
	return Promise.reject(new Error(util.format.apply(util, arguments)));
};

module.exports = Promise.method(function (opts) {
	if (opts.unlinkAll) return unlinkAll(opts);
	else if (opts.target) return unlink(opts);
	else return reject('must provide a target or have --global and --unlink-all set');
});

function unlink (opts) {
	
	if (Array.isArray(opts.target)) {
		return Promise.settle(opts.target.map(function (target) {
			var lopts = {target: target, global: opts.global, save: opts.save, env: opts.env};
			return unlink(lopts);
		}));
	}
	
	if (!opts.global && !opts.env.hasConfig()) {
		return reject('cannot unlink, not currently in a project');
	}
	
	return Promise.resolve(opts.global).then(function (isGlobal) {
		return isGlobal ? opts.env.userLinks : opts.env.get('libDir').then(function (libDir) {
			return libDir ? path.join(opts.env.cwd, libDir) : opts.env.cwd;
		});
	}).then(function (libDir) {
		var file = path.join(libDir, opts.target);
		return fs.lstatAsync(file).then(function (stat) {
			if (stat.isSymbolicLink()) {
				return fs.unlinkAsync(file).then(function () {
					var links, idx;
					if (opts.save) {
						links = opts.env.config.get('links');
						if (links && Array.isArray(links)) {
							if ((idx = links.indexOf(opts.target)) > -1) {
								links.splice(idx, 1);
								return opts.env.config.commit();
							}
						}
					}
				});
			} else return reject('invalid target to unlink, %s, not a symbolic link', opts.target);
		}, function () {
			return reject('invalid target to unlink, %s, does not exist', opts.target);
		});
	});
}

function unlinkAll (opts) {
	if (opts.global) return unlinkAllGlobal(opts);
	else if (!opts.env.hasConfig()) return reject('cannot unlink from non-project');
	return opts.env.get('libDir').then(function (libDir) {
		libDir = libDir ? path.join(opts.env.cwd, libDir) : opts.env.cwd;
		return fs.readdirAsync(libDir).then(function (files) {
			var symbolics = [];
			return Promise.all(files.map(function (file) {
				return fs.lstatAsync(path.join(libDir, file)).then(function (stat) {
					if (stat.isSymbolicLink()) symbolics.push(file);
				});
			})).then(function () {
				var changed = false;
				return Promise.all(symbolics.map(function (lib) {
					return fs.unlinkAsync(path.join(libDir, lib)).then(function () {
						var links, idx;
						if (opts.save) {
							links = opts.env.config.get('links');
							if (links && Array.isArray(links)) {
								if ((idx = links.indexOf(lib)) > -1) {
									links.splice(idx, 1);
									changed = true;
								}
							}
						}
					});
				})).then(function () {
					if (changed) return opts.env.config.commit();
				});
			});
		})
	});
}

function unlinkAllGlobal (opts) {
	return fs.readdirAsync(opts.env.userLinks).then(function (files) {
		return Promise.settle(files.map(function (file) {
			file = path.join(opts.env.userLinks, file);
			return fs.lstatAsync(file).then(function (stat) {
				if (stat.isSymbolicLink()) {
					return fs.unlinkAsync(file);
				}
			});
		}));
	});
}