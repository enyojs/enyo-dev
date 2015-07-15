'use strict';

var
	path = require('path');

var
	Promise = require('bluebird');

var
	fs = Promise.promisifyAll(require('fs-extra')),
	git = Promise.promisifyAll(require('gift')),
	osenv = require('osenv');

var
	reposDir = path.join(osenv.home(), '.enyo', 'repos'),
	utils = require('../../utils'),
	cli = require('../../cli-logger');

var exports = module.exports = Promise.method(function (lib, source, opts) {
	
	var gobj, uri, target, repoPath, libDir;
	
	// the parse object for the git uri components
	gobj = utils.parseGitUri(source);
	// the ultimate treeish after the # to signify what branch to checkout
	target = gobj.target;
	// the actual uri from which we should clone (if necessary)
	uri = utils.buildGitUri(gobj);
	// the path to the cached version of the repository
	repoPath = path.join(reposDir, lib);

	libDir = opts.env.getPackageValue('libDir') || opts.env.get('libDir') || 'lib';
	libDir = path.join(opts.env.cwd, libDir, lib);
	
	return checkLocal(libDir).then(function (isRepo) {
		if (isRepo) return updateLocal(libDir, target);
		else return ensureRepo(repoPath, uri).then(function () {
			return copy(repoPath, libDir);
		}).then(function () {
			return update(libDir, target);
		});
	});
});

function ensureRepo (repoPath, source) {
	return fs.statAsync(repoPath).then(function (ostat) {
		if (ostat.isDirectory()) {
			return checkRepo(repoPath).then(function (isRepo) {
				if (!isRepo) return fs.removeDirAsync(repoPath).then(function () {
					return cloneRepo(source, repoPath);
				});
				return fetchRepo(repoPath);
			});
		} else return fs.unlinkAsync(repoPath).then(function () {
			return cloneRepo(source, repoPath);
		});
	}, function () {
		return cloneRepo(source, repoPath);
	});
}

function checkRepo (repoPath) {
	return fs.statAsync(path.join(repoPath, '.git')).then(function (ostat) {
		return ostat.isDirectory();
	}, function () {
		return false;
	});
}

function fetchRepo (repoPath) {
	var repo = Promise.promisifyAll(git(repoPath));
	return repo.remote_fetchAsync('origin');
}

function cloneRepo (source, repoPath) {
	return git.cloneAsync(source, repoPath);
}

function copy (from, to) {
	return fs.ensureDirAsync(to).then(function () {
		return fs.copyAsync(from, to);
	});
}

function updateLocal (repoPath, target) {
	return fetchRepo(repoPath).then(function () {
		return update(repoPath, target);
	});
}

function update (repoPath, target) {
	var repo = Promise.promisifyAll(git(repoPath));
	return repo.checkoutAsync(target).then(function () {
		cli('checked out %s for %s', target, path.basename(repoPath));
	}, function (e) {
		cli('failed to checkout %s for %s', target, path.basename(repoPath), e);
	});
}

function checkLocal (repoPath) {
	return checkRepo(repoPath);
}