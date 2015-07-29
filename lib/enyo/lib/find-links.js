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
	link = require('./link');

var reject = function () {
	return Promise.reject(new Error(util.format.apply(util, arguments)));
};

module.exports = Promise.method(function (opts) {
	var root;
	
	if (opts.target && typeof opts.target == 'string') {
		root = path.join(opts.env.cwd, opts.target);
	} else root = opts.env.cwd;
	
	return findLinks(root, opts);
});

function findLinks (root, opts) {
	return fs.statAsync(root).then(function (stat) {
		if (!stat.isDirectory()) return reject('%s is not a directory', root);
	}, function () {
		return reject('cannot find %s, is it a valid path?', root);
	}).then(function () {
		return search(root);
	}).then(function (links) {
		return unique(links, opts, root);
	}).then(function (links) {
		return createLinks(links, opts);
	});
}

function search (root) {
	return fs.readdirAsync(root).then(function (files) {
		var ret = [];
		return Promise.settle(files.map(function (file) {
			file = path.join(root, file);
			return fs.lstatAsync(file).then(function (stat) {
				if (stat.isDirectory() && !stat.isSymbolicLink()) {
					return isLibrary(file).then(function (json) {
						json.path = file;
						return json;
					}, function () {
						return search(file);
					});
				} else return Promise.reject();
			});
		})).then(function (results) {
			results.forEach(function (result) {
				if (!result.isRejected()) {
					var value = result.value();
					if (Array.isArray(value)) {
						value.forEach(function (lib) { ret.push(lib); });
					} else ret.push(value);
				}
			});
			return ret;
		});
	}, function () {
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