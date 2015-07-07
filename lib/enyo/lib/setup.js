'use strict';

var
	fs = require('fs-extra'),
	path = require('path'),
	util = require('util');

var
	defined = require('defined'),
	osenv = require('osenv'),
	merge = require('merge'),
	clone = require('clone'),
	inq = require('inquirer');

var
	cli = require('../../cli-logger'),
	defaults = require('../defaults.json'),
	defaultConfig = require('../default-config.json');

var exports = module.exports = function (opts, done) {
	
	// if there are specific defaults associated with the current command we ensure we will use
	// them as well
	if (defaults[opts[0]]) {
		defaults = merge(true, defaults, defaults[opts[0]]);
	}

	exports.configFile(opts, function () {
		exports.configDir(opts, function () {
			exports.packageFile(opts, function () {
				done(opts);
			});
		});
	});
	
};

exports.defaultConfig = defaultConfig;

exports.getValueFromObject = function (obj, prop) {
	if (obj && defined(prop)) {
		if (typeof prop == 'string' && prop.indexOf('.') > -1) {
			var
				parts = prop.split('.'),
				next = obj;
			
			while (parts.length && defined(next)) {
				prop = parts.shift();
				next = next[prop];
			}
			
			return next;
		} else {
			return obj[prop];
		}
	}
};

exports.setValueOnObject = function (obj, prop, value, type, remove) {
	
	var
		parts, target, next, part, last;
	
	if (obj) {
		if (typeof prop == 'string' && prop.indexOf('.') > -1) {
			next = obj;
			parts = prop.split('.');
			last = parts.pop();
			while (parts.length) {
				part = parts.shift();
				next = next[part] || (next[part] = {});
			}
			target = next;
		} else {
			target = obj;
			last = prop;
		}
		
		if (typeof value == 'undefined' && remove !== true) {
			if (!type || type != 'array') delete target[last];
		} else if (remove === true) {
			if (!type || type != 'array' || typeof value == 'undefined') {
				delete target[last];
			} else {
				target = target[last];
				if (target && Array.isArray(target)) {
					var i = target.indexOf(value);
					if (i > -1) target.splice(i, 1);
				}
			}
		} else {
			if (!type || type != 'array') {
				target[last] = value;
			} else {
				if (!target[last]) {
					target = target[last] = [];
				} else if (!Array.isArray(target[last])) {
					throw new Error(util.format(
						'Invalid entry format for property %s, should be an Array',
						prop
					));
				} else target = target[last];
				
				if (target.indexOf(value) === -1) {
					target.push(value);
				}
			}
		}
	}
};

exports.configFile = function (opts, done) {
	
	var cfg = opts._cfg = {};
	
	// @todo These methods could/should probably be defined elsewhere
	opts.getValue = function (key) {
		return defined(
			exports.getValueFromObject(this, key),
			exports.getValueFromObject(this._cfg, key),
			exports.getValueFromObject(this._cfg.defaults, key),
			exports.getValueFromObject(defaults, key)
		);
	};
	
	opts.getGlobalValue = function (key) {
		return exports.getValueFromObject(opts._globalConfig, key);
	};
	
	opts.getCustomValue = function (key) {
		return exports.getValueFromObject(opts._customConfig, key);
	};
	
	opts.getLocalValue = function (key) {
		return exports.getValueFromObject(opts._localConfig, key);
	};
	
	opts.getPackageValue = function (key) {
		return exports.getValueFromObject(opts._packageFile, key);
	};
		
	var local = function () {
		fs.readJson('.enyoconfig', function (err, json) {
			if (err) {
				opts._localConfig = false;
			} else {
				opts._localConfig = clone(json);
				merge(cfg, json);
			}
			
			custom();
		});
	};
	
	var custom = function () {
		if (opts.configFile) {
			fs.readJson(opts.configFile, function (err, json) {
				if (err) throw new Error(util.format(
					'Could not read or parse the specified configuration file %s', opts.configFile
				));
				
				opts._customConfig = clone(json);
				merge(cfg, json);
				done();
			});
		} else {
			opts._customConfig = false;
			done();
		}
	};
	
	// we start with the home directory and then search local to ensure that the last options
	// in are the ones we use
	fs.readJson(path.join(osenv.home(), '.enyoconfig'), function (err, json) {
		if (err) {
			
			var writeGlobalConfig = function (_cfg) {
				fs.writeJson(path.join(osenv.home(), '.enyoconfig'), _cfg, function (err) {
					if (err) throw new Error(util.format(
						'There was an issue when writing the user-level configuration file\n\toriginal: %s',
						err.toString()
					));
					local();
				});
			};
			
			if (opts.interactive !== false) {
				inq.prompt([
					{
						name: 'defaults',
						type: 'confirm',
						message: util.format('(%s) We need to create the global configuration file, use defaults?',
							path.join(osenv.home(), '.enyoconfig')),
						default: true
					}
				], function (ans) {
					if (ans.defaults) opts._globalConfig = clone(defaultConfig, false);
					else opts._globalConfig = {};
					writeGlobalConfig(opts._globalConfig);
				});
			} else {
				opts._globalConfig = clone(defaultConfig, false);
				writeGlobalConfig(opts._globalConfig);
			}
		} else {
			opts._globalConfig = clone(json, false);
			merge(cfg, json);
			local();
		}
	});
};

exports.configDir = function (opts, done) {
	
	opts._configDir = path.join(osenv.home(), '.enyo');
	opts._linkDir = path.join(opts._configDir, 'links');
	
	fs.ensureDir(opts._configDir, function (err) {
		if (err) throw new Error(util.format(
			'Could not read or create the configuration directory %s', opts._configDir
		));
		
		fs.ensureDir(opts._linkDir, function (err) {
			if (err) throw new Error(util.format(
				'Could not read or create the configuration links directory %s', opts._linksDir
			));
			
			done();
		});
	});
};

exports.packageFile = function (opts, done) {
	if (!opts.configFile) {
		fs.stat(path.join(process.cwd(), 'package.json'), function (err, stat) {
			if (stat && stat.isFile()) {
				fs.readJson(path.join(process.cwd(), 'package.json'), function (err, json) {
					if (json) opts._packageFile = json;
					done();
				});
			} else done();
		});
	} else done();
};