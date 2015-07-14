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
	if (opts.target) return exports.unlinkLocal(opts);
	else return exports.unlinkLinkable(opts);
});

exports.unlinkLocal = function (opts) {
	var libDir, from;
	libDir = opts.env.getPackageValue('libDir') || opts.env.get('libDir') || 'lib';
	from = path.join(process.cwd(), libDir, opts.target);
	return fs.lstatAsync(from).then(function (ostat) {
		if (ostat && ostat.isSymbolicLink()) {
			return fs.unlinkAsync(from);
		}
	}, function () {});
};

exports.unlinkLinkable = function (opts) {
	var name, from;
	name = opts.env.getPackageValue('name') || path.basename(process.cwd());
	from = path.join(linksDir, name);
	return fs.lstatAsync(from).then(function (ostat) {
		if (ostat && ostat.isSymbolicLink()) {
			return fs.unlinkAsync(from);
		}
	}, function () {})
};