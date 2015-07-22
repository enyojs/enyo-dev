'use strict';

var
	util = require('util'),
	path = require('path');

var
	osenv = require('osenv'),
	clone = require('clone');

var
	Promise = require('bluebird'),
	EventEmitter = require('events').EventEmitter;

var
	// when running tests we don't use the current user's home directory
	home = global.testHome || osenv.home(),
	
	// user related paths
	u_dir = path.join(home, '.enyo'),
	u_config = path.join(u_dir, 'config'),
	u_defaults = path.join(u_dir, 'defaults'),
	u_links = path.join(u_dir, 'links'),
	u_projects = path.join(u_dir, 'projects'),
	
	// old files to look for as clues to an older setup
	o_config = path.join(home, '.enyoconfig'),
	o_dir = path.join(u_dir, 'repos');

var
	fs = Promise.promisifyAll(require('fs-extra'));

var
	cli = require('../../cli-logger');

module.exports = function (opts) {
	return opts.env ? Promise.resolve(opts) : new Promise(function (resolve) {
		var env = opts.env = new Env(opts);
		env.on('ready', function () { resolve(opts); });
	});
};

function get (prop) {
	var parts, base, ret, i, part;
	parts = Array.isArray(prop) ? prop.slice() : prop.split('.');
	base = this;
	for (i = 0; i < parts.length; ++i) {
		part = parts[i];
		if (base.hasOwnProperty(part)) {
			if (i + 1 === parts.length) {
				ret = base[part];
			} else {
				base = base[part];
			}
		} else break;
	}
	return ret;
}

function configGet (prop, defaults) {
	var ret;
	if (defaults) {
		if (this.defaults) {
			ret = get.call(this.defaults, prop);
		}
	} else {
		if (this.json) {
			ret = get.call(this.json, prop);
		}
		if (ret === undefined && this.defaults) {
			ret = get.call(this.defaults, prop);
		}
	}
	return ret;
}

function Env (opts) {
	var enyo = this;
	EventEmitter.call(this);
	this.cwd = opts.cwd || process.cwd();
	this.options = opts;
	this.scriptSafe = !! opts.scriptSafe;
	this.system = {};
	this.user = {get: configGet};
	this.package = {get: configGet};
	this.config = {get: configGet};
	this.initSystemDefaults().then(function () {
		return !enyo.scriptSafe && enyo.validateEnvironment();
	}).then(function () {
		return !enyo.scriptSafe && enyo.ensureUserConfig();
	}).then(function () {
		return enyo.loadLocals();
	}).finally(function () {
		enyo.emit('ready');
	});
}

util.inherits(Env, EventEmitter);

var proto = Env.prototype;

proto.initSystemDefaults = function () {
	var config, defaults, enyo, steps;
	enyo = this;
	config = path.join(__dirname, '../config.json');
	defaults = path.join(__dirname, '../defaults.json');
	steps = [
		fs.readJsonAsync(config).then(function (json) {
			enyo.system.config = json;
		}),
		fs.readJsonAsync(defaults).then(function (json) {
			enyo.system.defaults = json;
		})
	];
	return Promise.all(steps);
};

proto.validateEnvironment = function () {
	var enyo, steps;
	enyo = this;
	steps = [
		fs.statAsync(o_config).then(function (stat) {
			if (stat.isFile()) cli('You have a configuration file %s that is no longer used and ' +
				'can safely be removed. Ensure you copy any customizations to your configuration ' +
				'file %s where applicable.', o_config, u_config);
		}),
		fs.statAsync(o_dir).then(function (stat) {
			if (stat.isDirectory()) {
				cli('Removing an unused, deprecated directory %s. This should only happen once.', o_dir);
				return fs.remove(o_dir).catch(function (e) {
					cli('There was an issue removing %s, please remove this directory.', o_dir);
				});
			}
		})
	];
	// we expect to receive errors, in this case, that means they do not exist which is a
	// good thing
	return Promise.all(steps).catch(function (e) {});
};

proto.ensureUserConfig = function () {
	var enyo, steps;
	enyo = this;
	steps = [
		fs.ensureDirAsync(u_dir).then(function () {
			var steps = [
				fs.readJsonAsync(u_config).then(function (json) {
					enyo.user.json = json;
					enyo.user.hadConfig = true;
				}, function () {
					enyo.user.json = clone(enyo.system.config, true);
					return enyo.commit('u_config');
				}),
				fs.readJsonAsync(u_defaults).then(function (json) {
					enyo.user.defaults = json;
					enyo.user.hadDefaults = true;
				}, function () {
					enyo.user.defaults = clone(enyo.system.defaults, true);
					return enyo.commit('u_defaults');
				})
			];
			return Promise.all(steps);
		}),
		fs.ensureDirAsync(u_links),
		fs.ensureDirAsync(u_projects)
	];
	return Promise.all(steps);
};

proto.commit = function (which) {
	var data, file;
	switch (which) {
	case 'u_config':
		file = u_config;
		data = this.user.json;
		break;
	case 'u_defaults':
		file = u_defaults;
		data = this.user.defaults;
		break;
	case 'config':
		file = this.config.file;
		data = this.config.json;
		break;
	case 'package':
		file = this.package.file;
		data = this.package.json;
		break;
	}
	if (!data) return Promise.resolve();
	return fs.writeJsonAsync(file, data, {spaces: 2});
};

proto.loadLocals = function () {
	var enyo, opts, config, p_file, steps;
	enyo = this;
	opts = this.options;
	p_file = this.package.file = path.join(this.cwd, 'package.json');
	config = this.config.file = path.join(this.cwd, opts.configFile || '.enyoconfig');
	steps = [
		fs.readJsonAsync(p_file).then(function (json) {
			enyo.package.json = json;
		}, function () {}),
		fs.readJsonAsync(config).then(function (json) {
			enyo.config.json = json;
			return enyo.validateLocalConfig();
		}, function () {})
	];
	return Promise.all(steps);
};

proto.validateLocalConfig = Promise.method(function () {
	var json, valid, repl;
	json = this.config.json;
	valid = true;
	if (json.user) valid = false;
	if (json.defaults) valid = false;
	if (!valid) {
		cli('Upgrading your project configuration file, preserving customizations');
		this.config.json = repl = clone(this.system.defaults, true);
		Object.keys(repl).forEach(function (key) {
			if (json[key]) repl[key] = json[key];
			else if (json.defaults && json.defaults[key]) repl[key] = json.defaults[key];
		});
		return this.commit('config');
	}
});

proto.hasPackage = function () {
	return !! this.package.json;
};

proto.hasConfig = function () {
	return !! this.config.json;
};

proto.hadConfig = function () {
	return !! this.user.hadConfig;
};

proto.hadDefaults = function () {
	return !! this.user.hadDefaults;
};

proto.get = function (prop) {
	var parts, opts, ret;
	opts = this.options;
	parts = prop.split('.');
	
	// special case #1: if the first part is defaults
	if (parts[0] == 'defaults') {
		if (parts.length === 1) return this.user.defaults;
		else return this.user.get(parts.slice(1), true);
	} 
	
	if ((ret = get.call(opts, parts)) !== undefined) return ret;
	if ((ret = this.config.get(parts)) !== undefined) return ret;
	if ((ret = this.user.get(parts)) !== undefined) return ret;
};