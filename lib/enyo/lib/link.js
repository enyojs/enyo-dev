'use strict';

var
	path = require('path'),
	util = require('util');

var
	Promise = require('bluebird');

var
	fs = Promise.promisifyAll(require('fs-extra'));

var reject = function () {
	return Promise.reject(new Error(util.format.apply(util, arguments)));
};

module.exports = function (opts) {
	if (opts.target) return link(opts);
	else return linkable(opts);
};

function link (opts) {
	var target = opts.target;
	if (!opts.env.hasConfig()) {
		return reject('cannot link in non-project directory, no configuration found (%s)', opts.env.cwd);
	}
	if (Array.isArray(target) || (typeof target == 'string' && target.indexOf(',') > -1)) {
		return Promise.settle((Array.isArray(target) ? target : target.split(',')).map(function (sub) {
			var sopts = {target: sub, force: opts.force, save: opts.save, env: opts.env};
			return link(sopts);
		}));
	}
	return find(opts).then(function (source) {
		return opts.env.get('libDir').then(function (libDir) {
			libDir = libDir ? path.join(opts.env.cwd, libDir) : opts.env.cwd;
			return fs.ensureDirAsync(libDir).then(function () {
				target = path.join(libDir, target);
				return fs.lstatAsync(target).then(function (stat) {
					if (stat.isSymbolicLink()) {
						if (opts.force) {
							return unlink(target).then(function () {
								return symlink(source, target);
							});
						} else {
							return reject('%s is already a symbolic link, use the --force flag to recreate the link', target);
						}
					} else if (stat.isDirectory()) {
						if (opts.force) {
							return fs.removeAsync(target).then(function () {
								return symlink(source, target);
							});
						} else {
							return reject('%s is a directory, use the --force flag to overwrite the directory with the link', target);
						}
					} else {
						if (opts.force) {
							return fs.unlink(target).then(function () {
								return symlink(source, target);
							}, function (e) {
								return reject('could not overwrite the existing file at %s: %s', target, e.message);
							});
						} else {
							return reject('%s is a file, use the --force flag to overwrite the file with the link', target);
						}
					}
				}, function () {
					return symlink(source, target).then(function () {
						if (opts.save) {
							return opts.env.config.set('links', opts.target, true);
						}
					});
				});
			}, function (e) {
				return reject('could not create "libDir" (%s): %s', libDir, e.message);
			});
		});
	});
}

function find (opts) {
	var ldir, target;
	ldir = opts.env.userLinks;
	target = path.join(ldir, opts.target);
	return fs.lstatAsync(target).then(function (stat) {
		if (stat.isSymbolicLink()) return target;
		else if (stat.isDirectory()) return reject('%s is a directory, not a symbolic link', target);
		else if (stat.isFile()) return reject('%s is a file, not a symbolic link', target);
		else return reject('cannot identify %s, unable to use', target);
	}, function () {
		return reject('cannot find link for %s', opts.target);
	});
}

function symlink (source, target) {
	return fs.symlinkAsync(source, target, 'junction');
}

function unlink (target) {
	return fs.unlinkAsync(target);
}

function linkable (opts) {
	if (!opts.env.hasConfig()) {
		return reject('%s does not have a valid configuration file and is not linkable', opts.env.cwd);
	}
	return opts.env.get('name').then(function (name) {
		return find({target: name, env: opts.env}).then(function (source) {
			return fs.realpathAsync(source).then(function (realpath) {
				if (realpath !== opts.env.cwd) {
					if (opts.force) {
						return unlink(source).then(function () {
							return symlink(opts.env.cwd, path.join(opts.env.userLinks, name));
						});
					} else {
						return reject(
							'there is already a link for %s (%s), use --force to overwrite the existing link',
							name,
							source
						);
					}
				}
			});
		}, function () {
			return symlink(opts.env.cwd, path.join(opts.env.userLinks, name));
		});
	}, function () {
		return reject('cannot find a "name" in the current configuration');
	});
}