'use strict';

var
	path = require('path'),
	util = require('util');

var
	Promise = require('bluebird');

var
	merge = require('merge'),
	fs = Promise.promisifyAll(require('fs-extra'));

var
	link = require('./link'),
	git = require('./git');

var reject = function () {
	return Promise.reject(new Error(util.format.apply(util, arguments)));
};

module.exports = function (opts) {
	return initPackage(opts).then(function () {
		return initConfig(opts).then(function () {
			return updateConfig(opts);
		});
	}).then(function () {
		return initGitIgnore(opts);
	}).then(function () {
		return opts.dependencies !== false ? initLibraries(opts) : Promise.resolve();
	});
};

function initConfig (opts) {
	if (opts.config  !== false && !opts.env.hasConfig()) {
		return opts.env.config.copy();
	} else return Promise.resolve();
}

function updateConfig (opts) {
	if (opts.config !== false) {
		// we ensure that the configuration has all of the updated defaults for
		// any previously unspecified properties
		opts.env.config.json = merge(true, opts.env.system.defaults, opts.env.config.json);
		return opts.env.get('name').then(function (name) {
			name = name || opts.env.package.get('name') || path.basename(opts.env.cwd);
			opts.env.config.json.name = name;
			if (opts.package !== false && (!opts.env.package.get('name') || opts.env.package.get('name') != name)) {
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
		return opts.env.gitignore.update();
	} else return Promise.resolve();
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
			if (!libDir || typeof libDir != 'string') libDir = 'lib';

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
					dest = path.join(libDir, lib);
					gopts = {env: opts.env, destination: dest, source: source, target: target};

					if (!source) {
						throw new Error(util.format('cannot find a source entry for %s (skipping)', lib));
					}

					return fs.lstatAsync(dest).then(function (stat) {
						if (stat.isSymbolicLink()) {
							return reject('%s already exists as a symbolic link (skipping)', lib);
						} else if (stat.isFile()) {
							return reject('%s already exists as a file, please remove (skipping)', lib);
						} else if (stat.isDirectory()) {
							console.log('need git for %s', gopts.destination);
							// return git(gopts);
						}
					}, function () {
						console.log('need git for %s', gopts.destination);
						// return git(gopts);
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