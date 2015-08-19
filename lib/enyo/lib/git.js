'use strict';

var
	util = require('util'),
	path = require('path');

var
	Promise = require('bluebird');

var
	fs = Promise.promisifyAll(require('fs-extra')),
	git = Promise.promisifyAll(require('gift'));

var
	cli = require('../../cli-logger');

var reject = function () {
	return Promise.reject(new Error(util.format.apply(util, arguments)));
};

module.exports = Promise.method(function (opts) {
	var dest, target, source, lib;
	dest = opts.destination;
	target = opts.target;
	source = opts.source;
	lib = opts.library;
	return exists(dest).then(function (ex) {
		if (ex) return update(dest, target, lib);
		else return clone(dest, source, target, lib);
	});
});

function exists (dest) {
	dest = path.join(dest, '.git');
	return fs.statAsync(dest).then(function (stat) {
		return stat.isDirectory();
	}, function () {
		return false;
	});
}

function update (dest, target, lib) {
	var repo = Promise.promisifyAll(git(dest));
	cli('updating %s and checking out %s', lib, target);
	return repo.remote_fetchAsync('origin').then(function () {
		return checkout(dest, target, lib).then(function () {
			return repo.pullAsync().then(null, function (e) {
				return reject('failed to merge remote for %s: %s', lib, e.message);
			});
		});
	}, function (e) {
		return reject('failed to fetch remote for %s: %s', lib, e.message);
	});
}

function clone (dest, source, target, lib) {
	cli('cloning %s and checking out %s', lib, target);
	return setup(dest).then(function () {
		return git.cloneAsync(source, dest).then(null, function (e) {
			return reject('failed to clone %s: %s', lib, e.message);
		});
	}).then(function () {
		return checkout(dest, target, lib);
	});
}

function setup (dest) {
	return fs.statAsync(dest).then(function (stat) {
		return fs.removeAsync(dest);
	}, function () {});
}

function checkout (dest, target, lib) {
	var repo = Promise.promisifyAll(git(dest));
	return repo.checkoutAsync(target).then(null, function (e) {
		return reject('failed to checkout %s for %s: %s', target, lib, e.message);
	});
}