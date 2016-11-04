'use strict';

/*
Vastly updated over previous version, however, some changes could not be made
as desired because the change in pattern would require too much additional
time-consuming work...for now.
*/

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = setup;

var _osenv = require('osenv');

var _osenv2 = _interopRequireDefault(_osenv);

var _clone = require('clone');

var _clone2 = _interopRequireDefault(_clone);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _utilExtra = require('../../util-extra');

var _logger = require('../../logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// helper paths
// this may be modified in the env (mostly for testing purposes)
var HOME = process.env.ENYO_USER_HOME || _path2.default.join(_osenv2.default.home(), '.enyo');
var CONFIG = _path2.default.join(HOME, 'config');
var LINKS = _path2.default.join(HOME, 'links');
var TEMPLATES = _path2.default.join(HOME, 'templates');
var DEFAULTS = _path2.default.join(__dirname, '../defaults.json');
var DEFAULT_TEMPLATES = _path2.default.join(__dirname, './default-templates');

var defineProperty = Object.defineProperty;

// entry point for initializing an options object
// returns an environment variables hash with some accessor methods
function setup() {
	var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
	var setupEnv = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;


	var log = (0, _logger2.default)(opts).child({ component: 'env' });
	log.level(opts.logLevel || 'warn');

	var env = {
		cwd: opts.cwd && _path2.default.resolve(opts.cwd) || process.cwd(),
		system: getSystem({ log: log })
	};

	env.local = getLocalEnv({ log: log, cwd: env.cwd });

	if (opts.user !== false) {

		if (setupEnv) {
			if (!setupUserEnv({ log: log })) {
				(0, _logger.fatal)('Failed to setup environment for user, please use verbose output to see more information');
			}
		}

		env.HOME = HOME;
		env.CONFIG = CONFIG;
		env.LINKS = LINKS;
		env.TEMPLATES = TEMPLATES;
		env.user = getUserEnv({ log: log });
	}

	defineProperty(env, 'getConfig', { value: getConfig.bind(env), enumerable: true });

	return env;
}

// --
// Setup related functions not to be exported
// --

// these will always be executed regardless of user-mode
function getSystem(_ref) {
	var log = _ref.log;


	log.trace('Retrieving the system environment details');

	var sys = {
		defaults: _utilExtra.fsync.readJson(DEFAULTS).result,
		templates: getSystemTemplates({ log: log })
	};
	return sys;
}

// this only returns an object when in user mode
function getUserEnv(_ref2) {
	var log = _ref2.log;


	log.trace('Retrieving the user environment details');

	var usr = {
		config: _utilExtra.fsync.readJson(CONFIG).result || {},
		templates: getUserTemplates({ log: log })
	};

	defineProperty(usr, 'setConfig', { value: updateUserConfig.bind(usr, log), enumerable: true });

	return usr;
}

function getLocalEnv(_ref3) {
	var log = _ref3.log,
	    cwd = _ref3.cwd;
	var packageFile = _path2.default.join(cwd, 'package.json'),
	    configFile = _path2.default.join(cwd, '.enyoconfig'),
	    _fsync$readJson = _utilExtra.fsync.readJson(packageFile),
	    pkg = _fsync$readJson.result,
	    _fsync$readJson2 = _utilExtra.fsync.readJson(configFile),
	    cfg = _fsync$readJson2.result,
	    isProject = !!(pkg && (pkg.name || cfg && cfg.name));


	var loc = {
		// we don't want to be able to modify non-project package.json files so we try to be
		// selective here
		config: cfg || {},
		package: isProject && pkg,
		isProject: isProject
	};

	// temporary fallback for lowercase outdir/outfile properties
	if (!loc.config.outFile && loc.config.outfile) loc.config.outFile = loc.config.outfile;
	if (!loc.config.outDir && loc.config.outdir) loc.config.outDir = loc.config.outdir;

	if (isProject && loc.config) defineProperty(loc, 'setConfig', { value: updateLocalConfig.bind(loc, log, configFile), enumerable: true, writable: true });
	if (isProject && loc.package) defineProperty(loc, 'setPackage', { value: updateLocalPackage.bind(loc, log, packageFile), enumerable: true, writable: true });

	return loc;
}

// applied to env instances to retrieve the requested config property by order of preference
function getConfig(prop) {
	if (typeof prop != 'string') {
		for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
			args[_key - 1] = arguments[_key];
		}

		if (prop.hasOwnProperty(args[0])) return prop[args[0]];else return getConfig(args[0]);
	}
	if (this.local.config && this.local.config.hasOwnProperty(prop)) return this.local.config[prop];else if (this.user && this.user.config && this.user.config.hasOwnProperty(prop)) return this.user.config[prop];else return this.system.defaults[prop];
}

function setupUserEnv(_ref4) {
	var log = _ref4.log;


	var err = void 0,
	    ok = true;

	log.trace('Setting up user environment "' + HOME + '"');

	err = _utilExtra.fsync.ensureDir(HOME);
	if (err) {
		log.debug('Failed to ensure the user\'s home directory "' + HOME + '"', err);
		ok = false;
	}

	err = _utilExtra.fsync.ensureDir(LINKS);
	if (err) {
		log.debug('Failed to ensure the user\'s links directory "' + LINKS + '"', err);
		ok = false;
	}

	err = _utilExtra.fsync.ensureDir(TEMPLATES);
	if (err) {
		log.debug('Failed to ensure the user\'s templates directory "' + TEMPLATES + '"', err);
		ok = false;
	}

	err = _utilExtra.fsync.ensureJsonFile(CONFIG, {});
	if (err) {
		log.debug('Failed to ensure the user\'s config file "' + CONFIG + '"', err);
		ok = false;
	}

	return ok;
}

function updateUserConfig(log, prop, value) {
	var config = this.config;
	log.trace('Updating the user configuration file "' + CONFIG + '"');
	return update(CONFIG, config, prop, value);
}

function updateLocalConfig(log, file, prop, value) {
	var config = this.config;
	log.trace('Updating local configuration file "' + file + '"');
	return update(file, config, prop, value);
}

function updateLocalPackage(log, file, prop, value) {
	var pkg = this.package;
	log.trace('Updating local package.json file "' + file + '"');
	return update(file, pkg, prop, value);
}

function update(file, target, prop, value) {
	if (typeof prop == 'string') applyValue(target, prop, value);else {
		Object.keys(prop).forEach(function (key) {
			applyValue(target, key, prop[key]);
		});
	}
	return _utilExtra.fsync.writeJson(file, target);
}

function applyValue(target, prop, value) {
	if (value === undefined || null) {
		delete target[prop];
	} else {
		target[prop] = value;
	}
}

// --
// Template functions
// --

function getUserTemplates(_ref5) {
	var log = _ref5.log;

	return getTemplatesFromDir({ log: log, dir: TEMPLATES });
}

function getSystemTemplates(_ref6) {
	var log = _ref6.log;

	return getTemplatesFromDir({ log: log, dir: DEFAULT_TEMPLATES });
}

function getTemplatesFromDir(_ref7) {
	var log = _ref7.log,
	    dir = _ref7.dir;


	log.trace('Reading templates for directory "' + dir + '"');

	var _fsync$readDir = _utilExtra.fsync.readDir(dir),
	    result = _fsync$readDir.result;

	return result.map(function (loc) {
		return getTemplate({ log: log, template: _path2.default.join(dir, loc) });
	}).filter(function (template) {
		return template;
	}).reduce(function (map, template) {
		if (map[template.name]) log.warn('Duplicate template name "' + template.name + '" determined between "' + map[template.name].path + '" and "' + template.path + '", the last one encountered will be used');
		map[template.name] = template;
		return map;
	}, {});
}

function getTemplate(_ref8) {
	var log = _ref8.log,
	    template = _ref8.template;


	log.trace('Fetching template details for "' + template + '"');

	var _fsync$readJson3 = _utilExtra.fsync.readJson(_path2.default.join(template, '.enyoconfig')),
	    cnf = _fsync$readJson3.result,
	    _fsync$readJson4 = _utilExtra.fsync.readJson(_path2.default.join(template, 'package.json')),
	    pkg = _fsync$readJson4.result,
	    stat = _utilExtra.fsync.stat(template),
	    isLink = stat.isSymbolicLink(),
	    name = void 0;

	if (!pkg) {
		log.warn('Ignoring template from "' + template + '" because it does not have a package.json');
		return null;
	}

	name = pkg && pkg.name || cnf && cnf.name;
	if (!name) {
		log.warn('Ignoring template from "' + template + '" because it does not have a name defined in package.json or .enyoconfig');
		return null;
	}

	return {
		name: name,
		path: !isLink ? template : _utilExtra.fsync.realpath(template),
		link: isLink,
		linkPath: isLink ? template : null,
		config: cnf,
		package: pkg
	};
}