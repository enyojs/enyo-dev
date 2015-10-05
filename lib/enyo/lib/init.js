'use strict';

var
	path = require('path'),
	util = require('util');

var
	Promise = require('bluebird');

var
	merge = require('merge'),
	clone = require('clone'),
	fs = Promise.promisifyAll(require('fs-extra'));

var
	link = require('./link'),
	git = require('./git'),
	projects = require('./projects');

var reject = function () {
	return Promise.reject(new Error(util.format.apply(util, arguments)));
};

module.exports = function (opts) {
	return initPackage(opts).then(function () {
		return initConfig(opts).then(function () {
			return updateConfig(opts);
		}).then(function () {
			return updatePackage(opts);
		});
	}).then(function () {
		return initGitIgnore(opts);
	}).then(function () {
		return opts.dependencies !== false && !opts.library ? initLibraries(opts) : Promise.resolve();
	}).then(function () {
		if (opts.register !== false && opts.env.hasConfig()) opts.register = true;
		return opts.register ? projects(opts) : null;
	});
};

function initConfig (opts) {
	if (opts.config !== false && !opts.env.hasConfig()) {
		return opts.env.config.copy(opts.library);
	} else return Promise.resolve();
}

function updateConfig (opts) {
	if (opts.config !== false) {
		return opts.env.get('library').then(function (library) {
			opts.library = library;
		}).then(function () {
			// we ensure that the configuration has all of the updated defaults for
			// any previously unspecified properties
			if (opts.reset) {
				if (opts.library) opts.env.config.json = clone(opts.env.system.library, true);
				else opts.env.config.json = clone(opts.env.user.defaults, true);
			} else {
				if (opts.library) opts.env.config.json = merge(true, opts.env.system.library, opts.env.config.json || {});
				else opts.env.config.json = merge(true, opts.env.user.defaults, opts.env.config.json || {});
			}
			return opts.env.get('name').then(function (name) {
				name = name || opts.env.package.get('name') || path.basename(opts.env.cwd);
				opts.env.config.json.name = name;
				return name;
			}).then(function (name) {
				if (!opts.library) return opts.env.get('title').then(function (title) {
					title = title || opts.env.package.get('title') || name;
					opts.env.config.json.title = title;
				});
			}).then(function () {
				if (!opts.library) {
					if (opts.libraries && Array.isArray(opts.libraries) && opts.save) {
						opts.env.config.json.libraries = opts.libraries;
					}
					if (opts.links && Array.isArray(opts.links) && opts.save) {
						opts.env.config.json.links = opts.links;
					}
					if ((opts.linkAllLibs === true || opts.linkAllLibs === false) && opts.save) {
						opts.env.config.json.linkAllLibs = opts.linkAllLibs;
					}
				}
				return opts.env.config.commit();
			});
		});
	}
}

function updatePackage (opts) {
	if (opts.package !== false) {
		return opts.env.get('name').then(function (name) {
			if (name && name != opts.env.package.get('name')) {
				return opts.env.package.set('name', name).then(function () {
					return name;
				});
			}
		});
	} else return opts.env.get('name');
}

function initPackage (opts) {
	var name;
	
	if (opts.package !== false) {
		if (!opts.env.hasPackage()) opts.env.package.json = opts.env.system.package;
		// ensure that the final form has all of the properties that we want but
		// prioritize any that may already exist
		opts.env.package.json = merge(true, opts.env.system.package, opts.env.package.json);
		return opts.env.package.commit();
	} else return Promise.resolve();
}

function initGitIgnore (opts) {
	if (opts.gitIgnore !== false) {
		if (!opts.env.hasGitIgnore()) {
			return Promise.join(
				opts.env.get('libDir'),
				opts.env.get('outdir'),
				function (libDir, outdir) {
					var defaults = opts.env.system.gitignore.concat([libDir, outdir]);
					return opts.env.gitignore.set(defaults);
				}
			);
		}
	}
	return Promise.resolve();
}

function initLibraries (opts) {
	return Promise.join(
		getLibraries(opts),
		getLinkAllLibs(opts),
		getLinks(opts),
		getTargets(opts),
		getSources(opts),
		getLibDir(opts),
		function (libraries, linkAllLibs, links, targets, sources, libDir) {
			var actions, reason;
			// sanity
			if (!libraries || !Array.isArray(libraries)) {
				return Promise.resolve();
			}
			if (!links || !Array.isArray(links)) links = [];
			if (!targets || typeof targets != 'object') targets = {};
			if (!sources || typeof sources != 'object') sources = {};
			if (!libDir || typeof libDir != 'string') libDir = opts.env.system.defaults.libDir;

			actions = libraries.map(function (lib) {
				if (linkAllLibs || links.indexOf(lib) > -1) {
					// we need to link this library
					var lopts = {target: lib, env: opts.env, force: ! opts.safe};
					return link(lopts);
				} else {
					// we need to clone this repository
					var source, target, dest, gopts;
					source = sources[lib];
					target = targets[lib] || 'master';
					dest = path.join(opts.env.cwd, libDir, lib);
					gopts = {destination: dest, source: source, target: target, library: lib};

					if (!source) {
						return reject('cannot find a source entry for %s (skipping)', lib);
					}

					return fs.lstatAsync(dest).then(function (stat) {
						if (stat.isSymbolicLink()) {
							return reject('%s already exists as a symbolic link (skipping)', lib);
						} else if (stat.isFile()) {
							return reject('%s already exists as a file, please remove (skipping)', lib);
						} else if (stat.isDirectory()) {
							return git(gopts).then(null, function (e) {
								return reject('failed to handle git repository for %s: %s', lib, e.message);
							});
						}
					}, function () {
						return git(gopts).then(null, function (e) {
							return reject('failed to handle git repository for %s: %s', lib, e.message);
						});
					});
				}
			});
			return Promise.settle(actions);
		}
	);
}

function getLibraries (opts) {
	return opts.env.get('libraries');
}

function getLinkAllLibs (opts) {
	return opts.env.get('linkAllLibs');
}

function getLinks (opts) {
	if (opts.linkAvailable) return getLibraries(opts).then(function (libs) {
		return link.getLinkable(opts).then(function (avail) {
			if (avail && avail.length) return avail.map(function (e) {
				return e.name;
			}).filter(function (name) {
				return libs.indexOf(name) > -1;
			});
			else return [];
		});
	});
	return opts.env.get('links');
}

function getTargets (opts) {
	return opts.env.get('targets');
}

function getSources (opts) {
	return opts.env.get('sources');
}

function getLibDir(opts) {
	return opts.env.get('libDir');
}