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
	o_dir = path.join(u_dir, 'repos'),
	all = Promise.all;

var
	fs = Promise.promisifyAll(require('fs-extra'));

var
	cli = require('../../cli-logger');

var
	ERROR = {};

ERROR.SET_OBJECT = 'cannot set an object directly (%s)';
ERROR.SET_LOCAL = 'cannot set value on missing local configuration, use --global';
ERROR.SET_TARGET = 'cannot set without a target';
ERROR.SET_NOT_ARRAY = 'cannot set %s, it is not an array';
ERROR.SET_ON_NON_OBJECT = 'cannot set %s on non-object';
ERROR.SET_ON_ARRAY = 'cannot set value on an array (%s)';
ERROR.SET_DEFAULTS_MISSING = 'cannot set the defaults property on the requested context, no defaults';
ERROR.SET_CONFIG_MISSING = 'cannot set the property in the current configuration context, no known configuration';
ERROR.GET_TARGET = 'cannot get without a target';
ERROR.COMMIT_NO_FILE = 'cannot commit changes for %s, no known file';
ERROR.COMMIT_NO_DATA = 'cannot commit changed for %s, no known data';
ERROR.RESET_NON_DEFAULTS = 'cannot reset configuration for %s';
ERROR.RESET_NO_DEFAULT_VALUE = 'cannot reset configuration property %s, no default value known';
ERROR.RESET_NO_LOCAL = 'cannot reset local configuration, it does not exist';
ERROR.PACKAGE_PROPERTY_LENGTH = 'cannot access nested properties in package.json';

module.exports = function (opts) {
	return opts.env ? Promise.resolve(opts).then(function (opts) {
		opts.env.options = opts;
		return opts;
	}) : new Promise(function (resolve) {
		var env = opts.env = new Env(opts);
		env.on('ready', function () { resolve(opts); });
	});
};

function reject () {
	return Promise.reject(new Error(util.format.apply(util, arguments)));
}

function resolve (result) {
	return Promise.resolve(result);
}

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

function set (parts, value, remove) {
	var part, i, base;
	base = this;
	for (i = 0; i < parts.length; ++i) {
		part = parts[i];
		if (i + 1 === parts.length) {
			// special case where we encounter an array even without it being flagged as such
			if (base[part] && Array.isArray(base[part])) return mod.call(this, parts, value, remove);
			// another special case where it was some custom property that was an object already
			else if (base[part] && typeof base[part] == 'object' && !remove && typeof value != 'object') {
				return reject(ERROR.SET_OBJECT, parts.join('.'));
			} else {
				if (remove) {
					delete base[part];
				}
				else base[part] = value;
				return resolve();
			}
		} else {
			base = base[part] || (base[part] = {});
			if (typeof base != 'object') return reject(ERROR.SET_ON_NON_OBJECT, parts.join('.'));
			else if (Array.isArray(base)) return reject(ERROR.SET_ON_ARRAY, parts.join('.'));
		}
	}
}

function mod (parts, value, remove) {
	var part, i, base, arry, values;
	base = this;
	for (i = 0; i < parts.length; ++i) {
		part = parts[i];
		if (i + 1 === parts.length) {
			arry = base[part] || (base[part] = []);
			if (!Array.isArray(arry)) return reject(ERROR.SET_NOT_ARRAY, parts.join('.'));
			if (value !== undefined) {
				if (Array.isArray(value)) base[part] = value;
				else {
					values = value.split(',');
					values.forEach(function (val) {
						var idx = arry.indexOf(val);
						if (remove && idx > -1) {
							arry.splice(idx, 1);
						}
						else if (!remove && idx === -1) arry.push(val);
					});
				}
			} else if (remove) {
				delete base[part];
			}
			return resolve();
		} else {
			base = base[part] || (base[part] = {});
			if (Array.isArray(base)) return reject(ERROR.SET_ON_ARRAY, parts.join('.'));
			else if (typeof base != 'object') return reject(ERROR.SET_ON_NON_OBJECT, parts.join('.'));
		}
	}
}

function configSet (parts, value, array, defaults, remove) {
	var ret, ctx;
	ctx = this;
	if (typeof parts == 'string') parts = parts.split('.');
	if (defaults) {
		if (!this.defaults) return reject(ERROR.SET_DEFAULTS_MISSING);
		if (array) ret = mod.call(this.defaults, parts, value, remove);
		else ret = set.call(this.defaults, parts, value, remove);
	} else {
		if (!this.json) return reject(ERROR.SET_CONFIG_MISSING);
		if (array) ret = mod.call(this.json, parts, value, remove);
		else ret = set.call(this.json, parts, value, remove);
	}
	return ret.then(function () {
		return ctx.commit(defaults);
	});
}

function ignoreSet (adds, nocommit) {
	var i, len;
	len = this.lines.length;
	for (i = 0; i < adds.length; ++i) {
		if (this.lines.indexOf(adds[i]) === -1) {
			this.lines.push(adds[i]);
		}
	}
	if (len < this.lines.length && !nocommit) return this.commit();
	else return resolve();
}

function ignoreRemove (removes, nocommit) {
	var i, len, idx;
	len = this.lines.length;
	for (i = 0; i < removes.length; ++i) {
		idx = this.lines.indexOf(removes[i]);
		if (idx > -1) {
			this.lines.splice(idx, 1);
		}
	}
	if (len !== this.lines.length && !nocommit) return this.commit();
	else return resolve();
}

function ignoreCommit () {
	var src = this.lines.join('\n') + '\n';
	return fs.writeFileAsync(this.file, src, {encoding: 'utf8'});
}

function ignoreUpdate () {
	var defaults = this.system.gitignore;
	return this.gitignore.set(defaults);
}

function configCommit (defaults) {
	var file, data, name;
	if (defaults && this.defaults) {
		file = u_defaults;
		data = this.defaults;
		name = 'user.defaults';
	} else {
		file = this.file;
		data = this.json;
		name = this.name;
	}
	if (!file) return reject(ERROR.COMMIT_NO_FILE, name);
	if (!data) return reject(ERROR.COMMIT_NO_DATA, name);
	return fs.writeJsonAsync(file, data, {spaces: 2});
};

function copyConfig (library) {
	this.config.json = library ? clone(this.system.library) : clone(this.user.defaults);
	return this.config.commit();
}

function Env (opts) {
	var enyo = this;
	EventEmitter.call(this);
	this.cwd = opts.cwd || process.cwd();
	this.options = opts;
	this.userLinks = u_links;
	this.userProjects = u_projects;
	this.system = {};
	this.user = {get: configGet, set: configSet, commit: configCommit, name: 'user.config', file: u_config};
	this.package = {get: configGet, set: configSet, commit: configCommit, name: 'package.json'};
	this.config = {get: configGet, set: configSet, commit: configCommit, name: '.enyoconfig', copy: copyConfig.bind(enyo)};
	this.gitignore = {set: ignoreSet, commit: ignoreCommit, update: ignoreUpdate.bind(enyo), remove: ignoreRemove};
	this.initSystemDefaults().then(function () {
		return enyo.get('scriptSafe').then(function (scriptSafe) {
			return !scriptSafe && enyo.validateEnvironment();
		});
	}).then(function () {
		return enyo.get('scriptSafe').then(function (scriptSafe) {
			return !scriptSafe && enyo.ensureUserConfig();
		});
	}).then(function () {
		return enyo.loadLocals();
	}).finally(function () {
		enyo.emit('ready');
	});
}

util.inherits(Env, EventEmitter);

var proto = Env.prototype;

proto.initSystemDefaults = function () {
	var config, defaults, enyo, steps, knowns, ignore, pkg, libdefaults;
	enyo = this;
	config = path.join(__dirname, '../config.json');
	defaults = path.join(__dirname, '../defaults.json');
	knowns = path.join(__dirname, '../known-props.json');
	ignore = path.join(__dirname, '../git-ignore.json');
	pkg = path.join(__dirname, '../default-package.json');
	libdefaults = path.join(__dirname, '../library-defaults.json');
	steps = [
		fs.readJsonAsync(config).then(function (json) {
			enyo.system.config = json;
		}),
		fs.readJsonAsync(defaults).then(function (json) {
			enyo.system.defaults = json;
		}),
		fs.readJsonAsync(knowns).then(function (json) {
			enyo.system.knowns = json;
		}),
		fs.readJsonAsync(ignore).then(function (json) {
			enyo.system.gitignore = json;
		}),
		fs.readJsonAsync(pkg).then(function (json) {
			enyo.system.package = json;
		}),
		fs.readJsonAsync(libdefaults).then(function (json) {
			enyo.system.library = json;
		})
	];
	return Promise.all(steps);
};

proto.validateEnvironment = function () {
	var enyo, steps;
	enyo = this;
	steps = [
		fs.statAsync(o_config).then(function (stat) {
			if (stat.isFile()) cli('\nYou have a configuration file %s that is no longer used and ' +
				'can safely be removed.\nEnsure you copy any customizations to your configuration ' +
				'file %s where applicable.\n', o_config, u_config);
		}),
		fs.statAsync(o_dir).then(function (stat) {
			if (stat.isDirectory()) {
				cli('\nRemoving an unused, deprecated directory %s. This should only happen once.\n', o_dir);
				return fs.remove(o_dir).catch(function (e) {
					cli('There was an issue removing %s, please remove this directory.\n', o_dir);
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
					return enyo.user.commit();
				}),
				fs.readJsonAsync(u_defaults).then(function (json) {
					enyo.user.defaults = json;
					enyo.user.hadDefaults = true;
				}, function () {
					enyo.user.defaults = clone(enyo.system.defaults, true);
					return enyo.user.commit(true);
				})
			];
			return Promise.all(steps);
		}),
		fs.ensureDirAsync(u_links),
		fs.ensureDirAsync(u_projects)
	];
	return Promise.all(steps);
};

proto.loadLocals = function () {
	var enyo, opts, config, p_file, ignore, steps;
	enyo = this;
	opts = this.options;
	p_file = this.package.file = path.join(this.cwd, 'package.json');
	config = this.config.file = path.join(this.cwd, opts.configFile || '.enyoconfig');
	ignore = this.gitignore.file = path.join(this.cwd, '.gitignore');
	return fs.ensureDirAsync(this.cwd).then(function () {
		steps = [
			fs.readJsonAsync(p_file).then(function (json) {
				enyo.package.json = json;
			}, function () {}),
			fs.readJsonAsync(config).then(function (json) {
				enyo.config.json = json;
				return enyo.validateLocalConfig();
			}, function () {}),
			fs.readFileAsync(ignore, 'utf8').then(function (content) {
				if (content && content.length) {
					enyo.gitignore.lines = content.split('\n');
				} else enyo.gitignore.lines = [];
			}, function () {
				enyo.gitignore.lines = [];
			})
		];
		return Promise.all(steps);
	});
};

proto.validateLocalConfig = Promise.method(function () {
	var json, valid, repl, sources, dsources, link, enyo;
	json = this.config.json;
	valid = true;
	enyo = this;
	if (json.user) valid = false;
	if (json.defaults) valid = false;
	if (json.link) {
		valid = false;
		link = true;
	}
	if (json.isLibrary) valid = false;
	if (json.sources) {
		Object.keys(json.sources).forEach(function (source) {
			var v = json.sources[source];
			if (v.indexOf('#') > -1) {
				valid = false;
				sources = true;
			}
		});
	}
	if (json.defaults && json.defaults.sources) {
		Object.keys(json.defaults.sources).forEach(function (source) {
			var v = json.defaults.sources[source];
			if (v.indexOf('#') > -1) {
				valid = false;
				dsources = true;
			}
		});
	}
	if (!valid) {
		cli('\nUpgrading your project configuration file, preserving customizations\n');
		this.config.json = repl = clone(this.system.defaults, true);
		Object.keys(repl).forEach(function (key) {
			if (json[key]) repl[key] = json[key];
			else if (json.defaults && json.defaults[key] && enyo.isDefaultsProperty(key)) repl[key] = json.defaults[key];
			if (link) {
				repl.links = json.link;
			}
			if (sources || dsources) {
				var t = repl.targets;
				var d = sources ? json.sources : json.defaults.sources;
				Object.keys(d).forEach(function (source) {
					var v, parts;
					v = d[source];
					parts = v.split('#');
					if (parts.length > 1) {
						repl.sources[source] = parts[0];
						t[source] = parts[1];
					}
				});
			}
		});
		if (json.isLibrary) repl.library = true;
		return this.config.commit();
	}
});

proto.hasPackage = function () {
	return !! this.package.json;
};

proto.hasConfig = function () {
	return !! this.config.json;
};

proto.hasGitIgnore = function () {
	return this.gitignore.lines.length > 0;
};

proto.hadConfig = function () {
	return !! this.user.hadConfig;
};

proto.hadDefaults = function () {
	return !! this.user.hadDefaults;
};

proto.isDefaultsProperty = function (prop) {
	return Object.keys(this.system.defaults).indexOf(prop) > -1;
};

proto.isConfigProperty = function (prop) {
	return Object.keys(this.system.config).indexOf(prop) > -1;
};

proto.isProjectConfigProperty = function (prop) {
	return ['name', 'title'].indexOf(prop) > -1;
};

proto.isPackageProperty = function (prop) {
	return Object.keys(this.system.package).indexOf(prop) > -1;
};

proto.get = Promise.method(function (prop, global) {
	var parts, opts, ret, enyo;
	
	if (!prop || (!Array.isArray(prop) && typeof prop != 'string')) {
		return reject(ERROR.GET_TARGET);
	}
	
	enyo = this;
	opts = this.options;
	parts = Array.isArray(prop) ? prop : prop.split('.');
	
	// special case #1: if the first part is defaults
	if (parts[0] == 'defaults') {
		if (parts.length === 1) return resolve(this.user.defaults);
		else ret = this.user.get(parts.slice(1), true);
	// special case #2: to keep the value of this dynamic with changes we hijack the request
	} else if (parts[0] == 'interactive') {
		return this.get('scriptSafe').then(function (scriptSafe) {
			if (scriptSafe) return false;
			else {
				if (!global && ret === undefined) ret = get.call(opts, parts);
				if (!global && ret === undefined) ret = enyo.config.get(parts);
				if (ret === undefined && !enyo.isProjectConfigProperty(parts[0])) ret = enyo.user.get(parts);
				return ret;
			}
		});
	} else if (this.isPackageProperty(parts[0]) && !this.isProjectConfigProperty(parts[0])) {
		if (parts.length > 1) return reject(ERROR.PACKAGE_PROPERTY_LENGTH, parts.join('.'));
		ret = this.package.get(parts[0]);
	} else {
		if (!global && ret === undefined) ret = get.call(opts, parts);
		if (!global && ret === undefined) ret = this.config.get(parts);
		if (ret === undefined && !this.isProjectConfigProperty(parts[0])) ret = this.user.get(parts);
	}
	
	return resolve(ret);
});

proto.set = function (prop, value, global, array, remove) {
	var parts, part, values, type, i;
	
	parts = Array.isArray(prop) ? prop : prop.split('.');
	
	if (!prop && !Array.isArray(prop) && typeof prop != 'string') {
		return reject(ERROR.SET_TARGET);
	}
	
	if (!this.hasConfig() && !global && !parts[0] == 'defaults') {
		return reject(ERROR.SET_LOCAL);
	}
	
	part = parts[parts.length - 1];
	
	if (!this.validateProperty(part, remove, value)) return reject(ERROR.SET_OBJECT, parts.join('.'));
	array = array || (this.propertyTypeFor(part) == 'array');
	remove = remove || (value === undefined);
	
	for (i = 0; i < parts.length - 1; ++i) {
		type = this.propertyTypeFor(parts[i]);
		if (type && type != 'object') return reject(ERROR.SET_ON_NON_OBJECT, parts.join('.'));
	}

	// special case #1: if the first part is defaults
	if (parts[0] == 'defaults') {
		return this.user.set(parts.slice(1), value, array, true, remove);
	} else {
		if (global) return this.user.set(parts, value, array, this.isDefaultsProperty(parts[0]), remove);
		else return this.config.set(parts, value, array, null, remove);
	}
};

proto.remove = function (prop, value, global, array) {
	return this.set(prop, value, global, array, true);
};

proto.reset = function (prop, global) {
	var parts, value;
	
	if (prop) {
		parts = Array.isArray(prop) ? prop : prop.split('.');
		if ((parts[0] != 'defaults' && parts.length > 1) || (parts[0] == 'defaults' && parts.length > 2)) return reject(ERROR.RESET_NON_DEFAULTS, parts.join('.'));
		if (parts[0] == 'defaults') {
			value = this.system.defaults[parts[1]];
			if (value === undefined) return reject(ERROR.RESET_NO_DEFAULT_VALUE, parts.join('.'));
			return this.set(parts, value);
		} else if (global) {
			if (this.isConfigProperty(prop)) {
				value = this.system.config[parts[0]];
				if (value === undefined) return reject(ERROR.RESET_NO_DEFAULT_VALUE, parts.join('.'));
				return this.set(parts, value);
			} else if (this.isDefaultsProperty(prop)) {
				value = this.system.defaults[parts[0]];
				if (value === undefined) return reject(ERROR.RESET_NO_DEFAULT_VALUE, parts.join('.'));
				return this.set(parts, value);
			} else return reject(ERROR.RESET_NON_DEFAULTS, parts.join('.'));
		} else {
			if (this.isConfigProperty(prop)) {
				value = this.user.config[prop];
				if (value === undefined) return reject(ERROR.RESET_NO_DEFAULT_VALUE, parts.join('.'));
				return this.set(prop, value);
			} else if (this.isDefaultsProperty(prop)) {
				value = this.user.defaults[prop];
				if (value === undefined) return reject(ERROR.RESET_NO_DEFAULT_VALUE, parts.join('.'));
				return this.set(prop, value);
			} else return reject(ERROR.RESET_NON_DEFAULTS, parts.join('.'));
		}
	} else {
		if (global) {
			// reset everything
			this.user.defaults = clone(this.system.defaults);
			this.user.json = clone(this.system.config);
			return all([
				this.user.commit(true),
				this.user.commit()
			]);
		} else {
			// reset the local config if there is one
			if (!this.hasConfig()) return reject(ERROR.RESET_NO_LOCAL);
			this.config.json = clone(this.user.defaults);
			return this.config.commit();
		}
	}
};

proto.validateProperty = function (prop, remove, value) {
	return this.propertyTypeFor(prop) == 'object' && !remove && typeof value != 'object' ? false : true;
};

proto.propertyTypeFor = function (prop) {
	return this.system.knowns[prop];
};