'use strict';

var
	path = require('path'),
	fs = require('fs-extra'),
	util = require('util');

var
	defined = require('defined'),
	osenv = require('osenv'),
	inq = require('inquirer'),
	clone = require('clone');

var
	cli = require('../../cli-logger'),
	setup = require('./setup'),
	validProps = require('../config-properties.json');

var exports = module.exports = function (opts, done) {
	setup(opts, function (opts) {
		exports.config(opts, done);
	});
};

exports.config = function (opts, done) {
		
	var
		cfg, cfgFile, opt, paths, pos, entry;
	
	if (opts.listProperties === true) {
		if (done) done(validProps);
		else cli(validProps);
		return;
	}
	
	if (opts.init === true) {
		return initConfig(opts, function (ret) {
			setup(opts, function (opts) {
				done(ret);
			});
		});
	}
	
	if (!defined(opts.option) && opts.remove !== true) {
		cli('An OPTION must be defined, use --list to see valid options');
		if (done) done(false);
		return;
	}
	
	if (opts.get === true) {
		if (opts.global === true) {
			opt = opts.getGlobalValue(opts.option);
		} else if (opts.configFile) {
			opt = opts.getCustomValue(opts.option);
		} else opt = defined(opts.getLocalValue(opts.option), opts.getGlobalValue(opts.option));
		if (done) done(opt);
		else cli(opt);
		return;
	}
	
	if (opts.global) {
		cfg = opts._globalConfig;
		cfgFile = path.join(osenv.home(), '.enyoconfig');
	} else {
		if (opts.configFile) {
			cfg = opts._customConfig;
			cfgFile = opts.configFile;
		} else {
			cfg = opts._localConfig || (opts._localConfig = {});
			cfgFile = '.enyoconfig';
		}
	}
	
	opt = parseOption(opts.option);
	
	if (!isValidOption(opt)) {
		cli('%s is not a valid OPTION, use --list to see valid options', opt.full);
		if (done) done(false);
		return;
	}
	
	var update = function () {
		setup.setValueOnObject(cfg, opt.full, opts.value, opt.type, opts.remove);
	
		fs.writeJson(cfgFile, cfg, function (err) {
			if (err) {
				throw new Error(util.format(
					'Could not write to the configuration file %s\n\toriginal: %s',
					cfgFile,
					err.toString()
				));
				if (done) done(false);
				return;
			}
			if (done) done(true);
		});
	};
	
	fs.stat(cfgFile, function (err) {
		if (err && !opts.global) {
			if (opts.getValue('interactive') !== false) {
				inq.prompt([
					{
						name: 'write',
						type: 'confirm',
						message: util.format('(%s) The target configuration file does not exist, create it?', cfgFile),
						default: true
					}
				], function (ans) {
					if (ans.write) update();
					else if (done) done(false);
				});
				return;
			}
		}
		update();
	});
};

function parseOption (str) {
	var
		opt = {},
		parts, part, concat;
	
	if (typeof str == 'string') {
		if (str.indexOf('.') > -1) {
			parts = str.split('.');
			part = parts.pop();
			concat = parts.join('.');
			opt.base = concat;
			opt.part = part;
			if (validProps[str]) {
				opt.type = validProps[str];
			} else opt.type = validProps[opt.base];
		} else {
			opt.base = null;
			opt.part = str;
			opt.type = validProps[str];
		}
	}
	
	opt.full = str;
	
	return opt;
}

function isValidOption (opt) {
	var
		key, ret = false;
	
	if (opt.base) {
		if (validProps[opt.base]) {
			if (validProps[opt.base + '.' + opt.part]) return true;
			else if (validProps[opt.base] == 'object') return true;
			else return false;
		} else {
			key = 'defaults.' + opt.base;
			if (validProps[key]) {
				ret = true;
				opt.type = validProps[key];
			}
			key += '.' + opt.part;
			if (validProps[key]) {
				ret = true;
				opt.type = validProps[key];
			}
			return ret;
		}
	} else {
		if (validProps[opt.part]) return true;
		else {
			key = 'defaults.' + opt.part;
			if (validProps[key]) {
				ret = true;
				opt.type = validProps[key];
			}
			return ret;
		}
	}
}

function initConfig (opts, done) {
	
	var
		cfgFile, cfg;
	
	if (opts.global) {
		cfgFile = path.join(osenv.home(), '.enyoconfig');
	} else if (opts.configFile) {
		cfgFile = opts.configFile;
	} else {
		cfgFile = '.enyoconfig';
	}
	
	fs.stat(cfgFile, function (err) {
		if (err) {
			// the file didn't exist so we should write it
			
			var writeConfigFile = function () {
				fs.writeJson(cfgFile, cfg, function (err) {
					if (err) {
						throw new Error(util.format(
							'Could not write the configuration file %s\n\toriginal: %s',
							cfgFile,
							err.toString()
						));
						if (done) done(false);
						return;
					}
					if (done) done(true);
				});
			};
			
			if (opts.getValue('interactive') !== false && !opts.getValue('copyConfig')) {
				inq.prompt([
					{
						name: 'defaults',
						type: 'confirm',
						message: util.format('(%s) We need to create the configuration file, use defaults?', cfgFile),
						default: true
					}
				], function (ans) {
					if (ans.defaults) {
						cfg = clone(setup.defaultConfig, false);
						writeConfigFile();
					} else {
						inq.prompt([
							{
								name: 'action',
								type: 'list',
								message: 'How would you like to proceed?',
								choices: [
									{
										name: 'Copy current global configuration as a starting place',
										value: 'copy'
									},
									{
										name: 'I goofed, I actually do want the defaults for the convenience',
										value: 'defaults'
									},
									{
										name: 'Empty so I can configure it to my little heart\'s content, I like it, don\'t judge me',
										value: 'empty'
									}
								]
							}
						], function (ans) {
							switch (ans.action) {
							case 'copy':
								cfg = opts._globalConfig;
								break;
							case 'defaults':
								cfg = clone(setup.defaultConfig, false);
								break;
							case 'empty':
								cfg = {};
								break;
							}
							writeConfigFile();
						});
					}
				});
			} else {
				cfg = opts.getValue('copyConfig') ? opts._globalConfig : clone(setup.defaultConfig, false);
				writeConfigFile();
			}
		} else {
			if (done) done(true);
		}
	});
}