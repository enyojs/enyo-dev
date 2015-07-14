'use strict';

var
	path = require('path'),
	util = require('util'),
	assert = require('assert');

var
	Promise = require('bluebird');

var
	osenv = require('osenv'),
	inq = require('inquirer'),
	clone = require('clone');

var
	fs = Promise.promisifyAll(require('fs-extra'));

var
	cli = require('../../cli-logger');

var exports = module.exports = Promise.method(function (opts) {
	if (opts.init) return exports.init(opts);
	else if (opts.get || opts.value === undefined) return exports.get(opts);
	else if (opts.remove) return exports.remove(opts);
	else return exports.set(opts);
});

exports.init = function (opts) {
	var file = opts.global ? opts.env.globalConfigFile : opts.env.configFile;
	return fs.statAsync(file).then(function (ostat) {
		if (ostat && ostat.isFile()) {
			return initFileExists(file, opts);
		} else return initFile(file, opts);
	}, function () {
		return initFile(file, opts);
	});
};

exports.remove = function (opts) {
	return opts.env.remove(opts.target, opts.value, opts.global);
};

exports.get = function (opts) {
	var ret;
	if (opts.global) {
		ret = opts.env.getGlobal(opts.target);
	} else {
		ret = opts.env.get(opts.target);
	}
	if (!opts.silent) cli(ret);
	return Promise.resolve(ret);
};

exports.set = function (opts) {
	if (opts.array) {
		return opts.env.add(opts.target, opts.value, opts.global).then(function () {
			return exports.get(opts);
		});
	} else {
		return opts.env.set(opts.target, opts.value, opts.global).then(function () {
			return exports.get(opts);
		});
	}
};

function initFile (file, opts) {
	if (opts.env.get('useGlobalConfig')) {
		return fs.writeJsonAsync(file, clone(opts.env.globalConfig.projectDefaults), {spaces: 2});
	} else if (opts.env.get('useDefaultConfig') || !opts.env.get('interactive')) {
		return fs.writeJsonAsync(file, clone(opts.env.defaultConfig.projectDefaults), {spaces: 2});
	} else {
		return interactiveInitFile(file, opts).then(function (config) {
			return fs.writeJsonAsync(file, config, {spaces: 2});
		});
	}
}

function initFileExists (file, opts) {
	if (!opts.env.get('interactive')) {
		return Promise.resolve();
	} else {
		return interactiveInitFileExists(file, opts).then(function (overwrite) {
			if (overwrite) {
				return fs.unlinkAsync(file).then(function () {
					return initFile(file, opts);
				});
			} else return Promise.resolve();
		});
	}
}

function interactiveInitFile (file, opts) {
	return new Promise(function (resolve) {
		inq.prompt([
			{
				name: 'defaults',
				type: 'confirm',
				message: util.format('(%s) Should we use the defaults for the configuration file?', file),
				default: true
			},
			{
				name: 'action',
				type: 'list',
				message: 'How would you like to proceed?',
				choices: [
					{
						name: 'Copy your global configuration for project defaults',
						value: 'copy'
					},
					{
						name: 'Use defaults',
						value: 'defaults'
					},
					{
						name: 'Empty (you will need to configure this yourself)',
						value: 'empty'
					}
				],
				when: function (ans) {
					return ! ans.defaults;
				}
			}
		], function (ans) {
			if (ans.defaults || ans.action.defaults) {
				resolve(clone(opts.env.defaultConfig.projectDefaults));
			} else if (ans.action == 'copy') {
				resolve(clone(opts.env.globalConfig.projectDefaults));
			} else {
				resolve({});
			}
		});
	});
}

function interactiveInitFileExists (file, opts) {
	return new Promise(function (resolve) {
		inq.prompt([
			{
				name: 'action',
				type: 'confirm',
				message: util.format('(%s) The configuration file already exists, overwrite it?', file),
				default: true
			}
		], function (ans) {
			resolve(ans.action);
		});
	});
}