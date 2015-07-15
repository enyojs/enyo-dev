'use strict';

var
	path = require('path'),
	util = require('util');

var
	Promise = require('bluebird');

var
	fs = Promise.promisifyAll(require('fs-extra')),
	osenv = require('osenv'),
	inq = require('inquirer'),
	findIndex = require('find-index');

var
	cli = require('../../cli-logger'),
	link = require('./link'),
	linksDir = path.join(osenv.home(), '.enyo', 'links');

var exports = module.exports = Promise.method(function (opts) {
	var root = opts.target ? path.resolve(opts.target) : process.cwd();
	return fs.readdirAsync(root).then(function (files) {
		return files.map(function (file) { return path.join(root, file); });
	}).then(function (files) {
		return exports.resolveProjects(files);
	}).then(function (projects) {
		return exports.filterExisting(projects, opts);
	}).then(function (available) {
		return exports.finalize(available, opts);
	}).then(function (links) {
		return exports.linkAll(links, opts);
	}).catch(function (e) {
		cli('unable to read the requested directory for projects', e);
	});
});

exports.resolveProjects = function (files) {
	var settling = files.map(function (file) {
		return fs.statAsync(file).then(function (ostat) {
			if (ostat.isDirectory()) {
				return fs.readJsonAsync(path.join(file, 'package.json')).then(function (json) {
					if (json.name) {
						json.path = file;
						return json;
					}
					else return Promise.reject();
				});
			} else return Promise.reject();
		});
	});
	return Promise.settle(settling).then(function (results) {
		return results.filter(function (result) { return !result.isRejected(); }).map(function (result) {
			return {name: result.value().name, path: result.value().path};
		});
	});
};

exports.filterExisting = function (projects, opts) {
	return fs.readdirAsync(linksDir).then(function (links) {
		var seen, dupes, ok, dupeNames, idx;
		seen = [];
		dupes = {};
		ok = [];
		projects.forEach(function (proj) {
			if (seen.indexOf(proj.name) > -1) {
				if (!dupes[proj.name]) {
					dupes[proj.name] = [];
					idx = findIndex(ok, function (e) { return e.name == proj.name; });
					dupes[proj.name].push(ok[idx].path);
					ok.splice(idx, 1);
				}
				dupes[proj.name].push(proj.path);
			} else {
				seen.push(proj.name);
				if (links.indexOf(proj.name) === -1) {
					ok.push(proj);
				}
			}
		});
		if ((dupeNames = Object.keys(dupes)).length) {
			return exports.resolveDupes(dupeNames, dupes, opts).then(function (resolved) {
				return ok.concat(resolved);
			});
		}
		
		return ok;
	});
};

exports.resolveDupes = Promise.method(function (names, entries, opts) {
	if (!opts.ignoreDuplicates && opts.env.get('interactive') !== false) {
		var questions = [];
		names.forEach(function (name) {
			questions.push({
				name: name,
				type: 'list',
				message: util.format('(Which path for this duplicate project name (%s)?', name),
				choices: function () {
					return entries[name].map(function (p, i) {
						return {name: p, value: i};
					});
				}
			});
		});
		return new Promise(function (resolve) {
			var ret = [];
			inq.prompt(questions, function (ans) {
				names.forEach(function (name) {
					ret.push({
						name: name,
						path: entries[name][ans[name]]
					});
				});
				resolve(ret);
			});
		});
	} else return [];
});

exports.finalize = Promise.method(function (available, opts) {
	if (opts.env.get('interactive') !== false) {
		var questions = available.map(function (proj) {
			return {
				type: 'confirm',
				name: proj.name,
				message: util.format('Make %s linkable?', proj.name),
				default: true
			};
		});
		return new Promise(function (resolve) {
			inq.prompt(questions, function (ans) {
				resolve(available.filter(function (proj) {
					return ans[proj.name];
				}).map(function (proj) {
					proj.to = path.join(linksDir, proj.name);
					return proj;
				}));
			});
		});
	} else return available.map(function (proj) {
		proj.to = path.join(linksDir, proj.name);
		return proj;
	});
});

exports.linkAll = function (links, opts) {
	var settling = links.map(function (proj) {
		return link.createLink(proj.path, proj.to).catch(function (e) {
			cli('failed to link %s -> ', proj.name, e);
		});
	});
	return Promise.all(settling);
};