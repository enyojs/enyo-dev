'use strict';

var
	path = require('path'),
	util = require('util');

var
	Promise = require('bluebird');

var
	fs = Promise.promisifyAll(require('fs-extra')),
	findIndex = require('find-index'),
	inq = require('inquirer');

var
	env = require('./env'),
	link = require('./link'),
	cli = require('../../cli-logger');

var reject = function () {
	return Promise.reject(new Error(util.format.apply(util, arguments)));
};

module.exports = Promise.method(function (opts) {
	var root;
	
	if (opts.target && typeof opts.target == 'string') {
		root = path.join(opts.env.cwd, opts.target);
	} else root = opts.env.cwd;
	if (isNaN(opts.depth)) opts.depth = 2;
	if (opts.depth < 1) {
		cli('invalid depth value, using default of 2');
		opts.depth = 2;
	}
	return findLinks(root, opts);
});

function findLinks (root, opts) {
	return fs.statAsync(root).then(function (stat) {
		if (!stat.isDirectory()) return reject('%s is not a directory', root);
	}, function () {
		return reject('cannot find %s, is it a valid path?', root);
	}).then(function () {
		return search(root, opts, 0);
	}).then(function (links) {
		return unique(links, opts, root);
	}).then(function (links) {
		return createLinks(links, opts);
	});
}

function search (root, opts, depth) {
	return Promise.resolve(opts.depth).then(function (limit) {
		if (depth > limit) throw new Error('depth too deep');
		return fs.readdirAsync(root).then(function (files) {
			return files.map(function (file) { return path.join(root, file); });
		}).then(function (files) {
			return Promise.map(files, function (file) {
				return fs.lstatAsync(file).then(function (stat) {
					if (stat.isDirectory() && !stat.isSymbolicLink()) {
						return isLibrary(file).then(function (json) {
							json.path = file;
							return json;
						}, function () {
							return search(file, opts, depth + 1);
						});
					}
				}, function () {
					return null;
				});
			}).call('filter', function (result) {
				return !! result;
			}).call('reduce', function (prev, curr) {
				if (curr && Array.isArray(curr)) return prev.concat(curr);
				prev.push(curr);
				return prev;
			}, []);
		});
	}).catch(function (e) {
		return [];
	});
}

function isLibrary (dir) {
	var config = path.join(dir, '.enyoconfig');
	return fs.readJsonAsync(config).then(function (json) {
		if (json && json.library && json.name) {
			return json;
		} else return Promise.reject();
	});
}

function createLinks (links, opts) {
	return Promise.settle(links.map(function (entry) {
		if (entry instanceof Promise) return entry;
		return env({cwd: entry.path, force: opts.force}).then(function (opts) {
			return link(opts);
		});
	}));
}

function unique (links, opts, root) {
	// @todo not necessarily the most efficient way to do this...
	var ret, dups, seen, hasDups;
	ret = [];
	seen = [];
	dups = {};
	links.forEach(function (lib) {
		var idx, entry;
		if ((idx = seen.indexOf(lib.name)) > -1) {
			if (!(entry = dups[lib.name])) entry = dups[lib.name] = [];
			idx = findIndex(ret, function (e) { return e.name == lib.name; });
			entry.push(ret[idx]);
			entry.push(lib);
			ret.splice(idx, 1);
			hasDups = true;
		} else {
			seen.push(lib.name);
			ret.push(lib);
		}
	});
	
	if (hasDups) {
		return resolveDuplicates(dups, opts, root).then(function (links) {
			ret = ret.concat(links);
			return ret;
		});
	}
	return ret;
}

function resolveDuplicates (dups, opts, root) {
	return opts.env.get('interactive').then(function (interactive) {
		if (interactive) {
			var questions = [];
			Object.keys(dups).forEach(function (name) {
				var entries = dups[name];
				questions.push({
					name: name,
					type: 'list',
					message: util.format('The library, %s, has multiple sources, which is correct?', name),
					choices: function () {
						return entries.map(function (p, i) {
							return {name: path.relative(opts.env.cwd, p.path), value: i};
						});
					}
				});
			});
			return new Promise(function (resolve) {
				var ret = [];
				inq.prompt(questions, function (ans) {
					Object.keys(dups).forEach(function (name) {
						ret.push({name: name, path: dups[name][ans[name]].path});
					});
					resolve(ret);
				});
			});
		}
		return Object.keys(dups).map(function (name) {
			return reject('unable to link %s, duplicate sources found: %s', name, dups[name].map(function (e) {
				return path.relative(opts.env.cwd, e.path);
			}).join(', '));
		});
	});
}