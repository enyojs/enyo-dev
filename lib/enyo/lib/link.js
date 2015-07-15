'use strict';

var
	path = require('path');

var
	Promise = require('bluebird');

var
	fs = Promise.promisifyAll(require('fs-extra')),
	osenv = require('osenv');

var
	cli = require('../../cli-logger'),
	linksDir = path.join(osenv.home(), '.enyo', 'links');

var exports = module.exports = Promise.method(function (opts) {
	if (opts.target) return exports.linkLib(opts);
	else return exports.makeLinkable(opts);
});

exports.linkLib = function (opts, target) {
	if (!target) {
		target = opts.target;
		if (target.indexOf(',') > -1) {
			var targets = target.split(',').map(function (t) {
				return exports.linkLib(opts, t);
			});
			return Promise.all(targets);
		}
	}
	return exports.findLinkable(target).then(function (from) {
		var to, libDir;
		libDir = opts.env.getPackageValue('libDir') || opts.env.get('libDir') || 'lib';
		to = path.join(opts.env.cwd, libDir);
		return fs.ensureDirAsync(to).then(function () {
			to = path.join(to, target);
			return exports.createLink(from, to, opts.force);
		});
	}, function (e) {
		cli('cannot create link for %s: %s', target, e);
		return Promise.resolve();
	});
};

exports.makeLinkable = function (opts) {

	var name, to, from;
	
	from = opts.env.cwd;
	name = opts.env.getPackageValue('name') || path.basename(from);
	to = path.join(linksDir, name);
	
	return exports.createLink(from, to, opts.force);
};

exports.createLink = function (from, to, force) {
	return fs.lstatAsync(to).then(function (ostat) {
		if (ostat && ostat.isSymbolicLink()) {
			if (!force) {
				cli('a link already exists at %s, use --force to create the new link', to);
				return Promise.resolve();
			}
			return exports.unlink(to).then(function () {
				return exports.symlink(from, to);
			});
		} else if (force) {
			if (ostat.isDirectory()) {
				return fs.removeAsync(to).then(function () {
					return exports.symlink(from, to);
				});
			} else {
				return exports.unlink(to).then(function () {
					return exports.symlink(from, to);
				});
			}
		} else {
			cli('a %s already exists at %s, use --force to create the new link', ostat.isDirectory() ? 'directory' : 'file', to);
			return Promise.resolve();
		}
	}, function () {
		return exports.symlink(from, to);
	});
};

exports.symlink = function (from, to) {
	return fs.symlinkAsync(from, to, 'junction');
};

exports.unlink = function (target) {
	return fs.unlinkAsync(target);
};

exports.findLinkable = function (target) {
	var from = path.join(linksDir, target);
	return fs.lstatAsync(from).then(function (ostat) {
		if (!ostat || !ostat.isSymbolicLink()) {
			return Promise.reject('target not a linkable library resource');
		}
		return from;
	}, function () {
		return Promise.reject('no linkable library found');
	});
};
