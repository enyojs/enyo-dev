'use strict';

var
	path = require('path');

var
	Promise = require('bluebird');

var
	merge = require('merge');

module.exports = Promise.method(function (opts) {
	return initPackage(opts).then(function () {
		return initConfig(opts).then(function () {
			return updateConfig(opts);
		});
	}).then(function () {
		return initGitIgnore(opts);
	});
});

function initConfig (opts) {
	if (opts.config && !opts.env.hasConfig()) {
		return opts.env.config.copy();
	} else return Promise.resolve();
}

function updateConfig (opts) {
	if (opts.config) {
		// we ensure that the configuration has all of the updated defaults for
		// any previously unspecified properties
		opts.env.config.json = merge(true, opts.env.system.defaults, opts.env.config.json);
		return opts.env.get('name').then(function (name) {
			name = name || opts.env.package.get('name') || path.basename(opts.env.cwd);
			opts.env.config.json.name = name;
			if (!opts.env.package.get('name')) {
				// strange place to do this but since it can't be done until after...
				return opts.env.package.set('name', name).then(function () {
					return name;
				});
			} else return name;
		}).then(function (name) {
			return opts.env.get('title').then(function (title) {
				title = title || opts.env.package.get('title') || name;
				opts.env.config.json.title = title;
			});
		}).then(function () {
			if (opts.libraries && Array.isArray(opts.libraries) && opts.save) {
				opts.env.config.json.libraries = opts.libraries;
			}
			if (opts.links && Array.isArray(opts.links) && opts.save) {
				opts.env.config.json.links = opts.links;
			}
			if ((opts.linkAllLibs === true || opts.linkAllLibs === false) && opts.save) {
				opts.env.config.json.linkAllLibs = opts.linkAllLibs;
			}
			return opts.env.config.commit();
		});
	}
}

function initPackage (opts) {
	var name;
	
	if (opts.package) {
		if (!opts.env.hasPackage()) opts.env.package.json = opts.env.system.package;
		// ensure that the final form has all of the properties that we want but
		// prioritize any that may already exist
		opts.env.package.json = merge(true, opts.env.system.package, opts.env.package.json);
		return opts.env.package.commit();
	} else return Promise.resolve();
}

function initGitIgnore (opts) {
	if (opts.gitIgnore) {
		return opts.env.gitignore.update();
	} else return Promise.resolve();
}

// var
// 	path = require('path'),
// 	util = require('util');
//
// var
// 	Promise = require('bluebird');
//
// var
// 	fs = Promise.promisifyAll(require('fs-extra')),
// 	uniq = require('array-uniq');
//
// var
// 	config = require('./config'),
// 	link = require('./link'),
// 	git = require('./git'),
// 	cli = require('../../cli-logger'),
// 	gitLines = require('../default-git-ignore.json');
//
// var exports = module.exports = Promise.method(function (opts) {
// 	var root = path.resolve(opts.project || process.cwd());
// 	return fs.ensureDirAsync(root).then(function () {
// 		return exports.initConfiguration(root, opts);
// 	}).then(function () {
// 		return exports.initGitIgnore(root, opts);
// 	}).then(function () {
// 		return exports.initPackage(root, opts);
// 	}).then(function () {
// 		return exports.initLibraries(root, opts);
// 	});
// });
//
// exports.initPackage = function (root, opts) {
// 	var name, libDir, paths, opaths;
// 	name = opts.name || opts.env.getPackageValue('name') || path.basename(opts.cwd);
// 	libDir = opts.env.getPackageValue('libDir') || opts.env.get('libDir') || 'lib';
// 	if (name != opts.env.getPackageValue('name')) {
// 		opts.env.setPackageValue('name', name);
// 	}
// 	opts.env.setPackageValue('libDir', libDir);
// 	paths = opts.env.getPackageValue('paths');
// 	opaths = opts.env.get('paths');
// 	if (paths && Array.isArray(paths)) {
// 		paths = uniq(paths.concat(opaths));
// 	} else paths = opaths;
// 	// ensure that the libDir is in the paths array...
// 	if (paths.indexOf(libDir) === -1) paths.push(libDir);
// 	opts.env.setPackageValue('paths', paths);
// 	return opts.env.updatePackage();
// };
//
// exports.initGitIgnore = function (root, opts) {
// 	var ignore = path.join(root, '.gitignore');
// 	return fs.readFileAsync(ignore, 'utf8').then(function (contents) {
// 		var lines = uniq((contents ? contents.split('\n') : []).concat(gitLines));
// 		return fs.writeFileAsync(ignore, lines.join('\n'), {encoding: 'utf8'});
// 	}, function () {
// 		return fs.writeFileAsync(ignore, gitLines.join('\n'), {encoding: 'utf8'});
// 	});
// };
//
// exports.initConfiguration = function (root, opts) {
// 	if (opts.env.hasGlobalConfig()) return config.init(opts);
// 	else {
// 		opts.global = true;
// 		return config.init(opts).then(function () {
// 			delete opts.global;
// 			return config.init(opts);
// 		});
// 	}
// };
//
// exports.initLibraries = function (root, opts) {
// 	var libs, toLink, sources, lalibs, libDir;
// 	libs = opts.libraries || opts.env.get('libraries');
// 	toLink = opts.link ? uniq(opts.link.concat(opts.env.get('link') || [])) : (opts.env.get('link') || []);
// 	sources = opts.env.get('sources');
// 	lalibs = opts.env.get('linkAllLibs');
// 	opts.force = true;
// 	libDir = opts.env.getPackageValue('libDir') || opts.env.get('libDir') || 'lib';
// 	libDir = path.join(root, libDir);
// 	libs = libs.map(function (lib) {
// 		var source;
// 		if (lalibs || toLink.indexOf(lib) > -1) {
// 			return link.linkLib(opts, lib);
// 		} else {
// 			source = sources[lib];
// 			if (!source) {
// 				cli('no source provided for %s, skipping', lib);
// 				return Promise.resolve();
// 			} else return fs.lstatAsync(path.join(libDir, lib)).then(function (ostat) {
// 				if (ostat.isSymbolicLink()) {
// 					cli('%s already present as a symbolic link, skipping', lib);
// 					return Promise.resolve();
// 				} else if (!ostat.isDirectory()) {
// 					cli('%s is present and is not a symbolic link or a directory, please remove, skipping',
// 						path.relative(opts.env.cwd, path.join(libDir, lib)));
// 					return Promise.resolve();
// 				} return git(lib, source, opts);
// 			}, function () {
// 				return git(lib, source, opts);
// 			});
// 		}
// 	});
// 	return Promise.all(libs);
// };