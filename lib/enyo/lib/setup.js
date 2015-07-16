'use strict';

var
	util = require('util'),
	assert = require('assert'),
	path = require('path');

var
	osenv = require('osenv'),
	clone = require('clone');

var
	Promise = require('bluebird'),
	EventEmitter = require('events').EventEmitter;

var
	defaultFile = path.join(__dirname, '../default-config.json'),
	knownPropsFile = path.join(__dirname, '../known-props.json'),
	globalFile = path.join(osenv.home(), '.enyoconfig'),
	globalDir = path.join(osenv.home(), '.enyo'),
	cli = require('../../cli-logger');

var
	fs = Promise.promisifyAll(require('fs-extra'));

module.exports = function (opts) {
	return opts.env ? Promise.resolve(opts) : new Promise(function (resolve) {
		var env = opts.env = new EnyoEnv(opts);
		env.on('ready', function () { resolve(opts); });
	});
};

function EnyoEnv (opts) {
	var enyo = this;
	EventEmitter.call(this);
	this.cwd = opts.cwd || process.cwd();
	this.options = opts;
	this.globalConfigFile = globalFile;
	this.globalConfigDir = globalDir;
	this.configFile = path.resolve(opts.configFile || path.resolve(this.cwd, '.enyoconfig'));
	this.initDefault().then(function () {
		return enyo.initGlobal();
	}).then(function () {
		return enyo.initLocal();
	}).then(function () {
		return enyo.initPackage();
	}).then(function () {
		return enyo.emit('ready', enyo);
	});
}

util.inherits(EnyoEnv, EventEmitter);

var proto = EnyoEnv.prototype;

proto.get = function (prop, objs) {
	
	var
		roots = objs || [this.options, this.localConfig, this.globalConfig, this.globalConfig.projectDefaults, this.defaultConfig, this.defaultConfig.projectDefaults],
		parts = prop.split('.'),
		ret, root, base, part, i;
	
	while (roots.length && ret === undefined) {
		root = roots.shift();
		if (root) {
			base = root;
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
		}
	}
	
	return ret;
};

proto.getPackageValue = function (prop) {
	return this.packageConfig[prop];
};

proto.setPackageValue = function (prop, value) {
	this.packageConfig[prop] = value;
};

proto.hasPackage = function () {
	return Object.keys(this.packageConfig).length > 0;
};

proto.getGlobal = function (prop) {
	return this.get(prop, [this.globalConfig, this.globalConfig.projectDefaults])
};

proto.set = function (prop, value, global) {
	
	var type, parts, root, last, base, i, part;
	
	assert(global || this.localConfig, 'no local configuration found');
	
	if ((type = this.knownProps[prop]) == 'array') return this.add(prop, value, global);
	else if (typeof value == 'string' && value.indexOf(',') > -1) return this.add(prop, value, global);
	
	root = global ? this.globalConfig : this.localConfig;
	parts = prop.split('.');
	last = parts.pop();
	base = root;
	
	// we will still have another case to check for array using the last value
	
	if (parts.length) {
		for (i = 0; i < parts.length; ++i) {
			part = parts[i];
			base = base[part] || (base[part] = {});
		}
	}
	
	if (Array.isArray(base[last])) {
		return this.add(prop, value, global);
	}
	
	base[last] = value;
	
	// now to determine which configuration we updated and then write the change
	if (global) return this.updateGlobalConfiguration();
	else return this.updateLocalConfiguration();
};

proto.add = function (prop, value, global) {
	
	var parts, root, base, i, part, last, updated;
	
	assert(global || this.localConfig, 'no local configuration found');
	
	root = global ? this.globalConfig : this.localConfig;
	parts = prop.split('.');
	last = parts.pop();
	base = root;
	
	if (parts.length) {
		for (i = 0; i < parts.length; ++i) {
			part = parts[i];
			base = base[part] || (base[part] = {});
		}
	}
	
	if (Array.isArray(base[last])) {
		base = base[last];
	} else {
		base = base[last] = [];
	}
	
	parts = typeof value == 'string' ? value.split(',') : [value];
	for (i = 0; i < parts.length; ++i) {
		part = parts[i];
		if (base.indexOf(part) === -1) {
			updated = true;
			base.push(part);
		}
	}
	
	if (updated) {
		if (global) return this.updateGlobalConfiguration();
		else return this.updateLocalConfiguration();
	} else return Promise.resolve();
};

proto.remove = function (prop, value, global) {
	
	var parts, root, base, i, last, part, updated, idx;
	
	assert(global || this.localConfig, 'no local configuration found');
	
	root = global ? this.globalConfig : this.localConfig;
	parts = prop.split('.');
	last = parts.pop();
	base = root;
	
	if (parts.length) {
		for (i = 0; i < parts.length; ++i) {
			part = parts[i];
			base = base[part];
			if (!base) return Promise.resolve();
		}
	}
	
	if (base[last] != null) {
		if (Array.isArray(base[last])) {
			if (value != null) {
				base = base[last];
				parts = typeof value == 'string' ? value.split(',') : [value];
				for (i = 0; i < parts.length; ++i) {
					part = parts[i];
					idx = base.indexOf(part);
					if (idx > -1) {
						updated = true;
						base.splice(idx, 1);
					}
				}
			}
		} else {
			udpated = true;
			delete base[last];
		}
	} else return Promise.resolve();
	
	if (updated) {
		if (global) return this.updateGlobalConfiguration();
		else return this.updateLocalConfiguration();
	}
};

proto.initDefault = function () {
	var enyo = this;
	return fs.readJsonAsync(defaultFile).then(function (json) {
		enyo.defaultConfig = json;
		return enyo.initKnownProps();
	});
};

proto.initGlobal = function () {
	var enyo = this;
	return this.initGlobalConfig().then(function () {
		return enyo.initGlobalDirs();
	});
};

proto.initGlobalConfig = function () {
	var enyo = this;
	return fs.statAsync(this.globalConfigFile).then(function (ostat) {
		if (ostat && ostat.isFile()) {
			return fs.readJsonAsync(globalFile).then(function (json) {
				// need to validate to ensure that the configuration is up-to-date and proper
				return enyo.validateGlobalConfiguration(json);
			});
		} else return enyo.makeGlobalConfig();
	}, function () {
		// no global found so we need to proceed with either creating it dynamically or
		// directly with defaults
		return enyo.makeGlobalConfig();
	});
};

proto.initGlobalDirs = function () {
	var enyo = this;
	return fs.ensureDirAsync(this.globalConfigDir)
		.then(function () {
			return fs.ensureDirAsync(path.join(enyo.globalConfigDir, 'links'));
		})
		.then(function () {
			return fs.ensureDirAsync(path.join(enyo.globalConfigDir, 'repos'));
		});
};

proto.initLocal = function () {
	var enyo = this;
	return fs.statAsync(this.configFile).then(function (ostat) {
		if (ostat && ostat.isFile()) {
			return fs.readJsonAsync(enyo.configFile).then(function (json) {
				return enyo.validateLocalConfiguration(json);
			});
		} else {
			enyo.localConfig = null;
		}
	}, function () {
		enyo.localConfig = null;
	});
};

proto.initPackage = function () {
	var
		enyo = this,
		file = this.packageFile = path.join(this.cwd, 'package.json');
	return fs.statAsync(file).then(function (ostat) {
		if (ostat && ostat.isFile()) {
			return fs.readJsonAsync(file).then(function (json) {
				enyo.packageConfig = json;
			});
		} else {
			enyo.packageConfig = {};
		}
	}, function () {
		enyo.packageConfig = {};
	});
};

proto.makeGlobalConfig = function () {
	// ideally we would have a complete walkthrough for generation but for now we will juse
	// use defaults when creating the global config file
	this.globalConfig = clone(this.defaultConfig);
	return fs.writeJsonAsync(globalFile, this.globalConfig, {spaces: 2});
};

proto.initKnownProps = function () {
	var enyo = this;
	return fs.readJsonAsync(knownPropsFile).then(function (json) {
		enyo.knownProps = json;
	});
};

proto.updateGlobalConfiguration = function () {
	return fs.writeJsonAsync(globalFile, this.globalConfig, {spaces: 2});
};

proto.updateLocalConfiguration = function () {
	if (this.localConfig) {
		return fs.writeJsonAsync(this.configFile, this.localConfig, {spaces: 2});
	} else throw new Error('cannot update local configuration because it does not exist');
};

proto.updatePackage = function () {
	return fs.writeJsonAsync(this.packageFile, this.packageConfig, {spaces: 2});
};

/**
* This is designed based on the current time constraint. It should be noted that adding this as
* an automatic check is for ease-of-use but doesn't make practical sense in the long-run. In
* future releases if no changes are occurring then this should ultimately be removed.
*/
proto.validateGlobalConfiguration = Promise.method(function (json) {
	
	var valid = true, repl;
	
	// these were the token root keys on the old configuration defaults
	if (json.user) valid = false;
	if (json.defaults) valid = false;
	
	if (!valid) {
		cli('upgrading your global configuration file');
		this.globalConfig = repl = clone(this.defaultConfig);
		Object.keys(repl.projectDefaults).forEach(function (key) {
			// we have to check and see if it had a local variable and then the default value
			if (json[key]) repl.projectDefaults[key] = json[key];
			else if (json.defaults && (json.defaults[key] != null)) repl.projectDefaults[key] = json.defaults[key];
		});
		Object.keys(repl).forEach(function (key) {
			if (key == 'projectDefaults') return;
			if (json[key]) repl[key] = json[key];
			else if (json.defaults && (json.defaults[key] != null)) repl[key] = json.defaults[key];
		});
		return this.updateGlobalConfiguration();
	}
	
	this.globalConfig = json;
});

proto.validateLocalConfiguration = Promise.method(function (json) {
	
	var valid = true, repl;
	
	if (json.user) valid = false;
	if (json.defaults) valid = false;
	
	if (!valid) {
		cli('upgrading your project configuration file');
		this.localConfig = repl = clone(this.defaultConfig.projectDefaults);
		Object.keys(repl).forEach(function (key) {
			if (json[key]) repl[key] = json[key];
			else if (json.defaults && json.defaults[key]) repl[key] = json.defaults[key];
		});
		return this.updateLocalConfiguration();
	}
	
	this.localConfig = json;
});