'use strict';

var
	path = require('path');

var
	Promise = require('bluebird');

var
	fs = Promise.promisifyAll(require('fs')),
	osenv = require('osenv');

var
	cli = require('../../cli-logger'),
	linksDir = path.join(osenv.home(), '.enyo', 'links');

var exports = module.exports = Promise.method(function (opts) {
	if (opts.unlinkAll) return exports.unlinkAll(opts);
	else if (opts.target && !opts.global) return exports.unlinkLocal(opts);
	else return exports.unlinkLinkable(opts);
});

exports.unlinkLocal = function (opts, target) {
	if (!target) {
		target = opts.target;
		if (target.indexOf(',') > -1) {
			var targets = target.split(',').map(function (t) {
				return exports.unlinkLocal(opts, t);
			});
			return Promise.all(targets);
		}
	}
	
	var libDir, from;
	libDir = opts.env.getPackageValue('libDir') || opts.env.get('libDir') || 'lib';
	from = path.join(process.cwd(), libDir, target);
	return fs.lstatAsync(from).then(function (ostat) {
		if (ostat && ostat.isSymbolicLink()) {
			return fs.unlinkAsync(from);
		}
	}, function () {});
};

exports.unlinkLinkable = function (opts) {
	var name, targets;
	name = getNameFrom(opts);
	targets = name.split(',').map(function (name) {
		var from = path.join(linksDir, name);
		return fs.lstatAsync(from).then(function (ostat) {
			if (ostat.isSymbolicLink()) {
				return fs.unlinkAsync(from);
			}
		}, function () {});
	});
	return Promise.all(targets);
};

function getNameFrom (opts) {
	return opts.global && opts.target ? opts.target : (
		opts.env.getPackageValue('name') || path.basename(process.cwd())
	);
}

exports.unlinkAll = function (opts) {
	if (opts.env.hasPackage() && !opts.global) return exports.unlinkAllLocal(opts);
	else return fs.readdirAsync(linksDir).then(function (links) {
		return links.map(function (link) { return path.join(linksDir, link); });
	}).then(function (links) {
		links = links.map(function (link) {
			return fs.lstatAsync(link).then(function (ostat) {
				if (!ostat.isSymbolicLink()) {
					cli('ignoring %s because it is not a symbolic link', path.basename(link));
					return Promise.resolve();
				}
				return fs.unlinkAsync(link);
			}, function () {
				return Promise.resolve();
			});
		});
		return Promise.all(links);
	})
};

exports.unlinkAllLocal = function (opts) {
	var libDir = opts.env.getPackageValue('libDir') || opts.env.get('libDir') || 'lib';
	libDir = path.join(process.cwd(), libDir);
	return fs.readdirAsync(libDir).then(function (links) {
		return links.map(function (link) { return path.join(libDir, link); });
	}).then(function (links) {
		links = links.map(function (link) {
			return fs.lstatAsync(link).then(function (ostat) {
				if (ostat.isSymbolicLink()) {
					return fs.unlinkAsync(link);
				}
				return Promise.resolve();
			}, function () {
				return Promise.resolve();
			});
		});
		return Promise.all(links);
	});
};