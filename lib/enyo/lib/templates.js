'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getDefaultTemplate = exports.getTemplates = undefined;
exports.default = templates;

var _colors = require('colors');

var _colors2 = _interopRequireDefault(_colors);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _logger = require('../../logger');

var _logger2 = _interopRequireDefault(_logger);

var _utilExtra = require('../../util-extra');

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _git = require('./git');

var _git2 = _interopRequireDefault(_git);

var _env = require('./env');

var _env2 = _interopRequireDefault(_env);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var didSet = false,
    logBase = void 0;

function getLog(opts) {
	if (!didSet) {
		logBase = (0, _logger2.default)(opts).child({ component: 'templates' });
		logBase.level(opts.logLevel || 'warn');
		didSet = true;
	}
	return logBase;
}

function checkUser(opts) {
	var log = getLog(opts);
	if (opts.user === false) {
		log.warn('Cannot complete template related request in non-user mode');
		return false;
	}
	return true;
}

/*
Manage templates. Returns a promise.
*/
function templates(_ref) {
	var opts = _ref.opts,
	    env = _ref.env;


	var log = getLog(opts);

	if (opts.action == 'add') return add({ opts: opts, env: env, log: log });else if (opts.action == 'remove') return remove({ opts: opts, env: env, log: log });else if (opts.action == 'list') return list({ opts: opts, env: env, log: log });else if (opts.action == 'install') return install({ opts: opts, env: env, log: log });else if (opts.action == 'default') return setDefault({ opts: opts, env: env, log: log });else {
		log.warn('Cannot complete' + (opts.action ? ' unknown action "' + opts.action + '"' : ' no action provided'));
		return false;
	}
}

function add(_ref2) {
	var opts = _ref2.opts,
	    env = _ref2.env,
	    log = _ref2.log;


	log.debug('Attempting to add template from "' + (opts.target || env.cwd) + '"');

	if (!checkUser(opts)) return false;

	if (!opts.target) log.debug('Using the current working directory as the target to add since no "target" was provided (' + env.cwd + ')');

	var target = _path2.default.resolve(opts.target || env.cwd),
	    templates = getTemplates(env);

	if (_utilExtra.fsync.exists(target)) {
		var _fsync$readJson = _utilExtra.fsync.readJson(_path2.default.join(target, '.enyoconfig')),
		    config = _fsync$readJson.result,
		    _fsync$readJson2 = _utilExtra.fsync.readJson(_path2.default.join(target, 'package.json')),
		    pkg = _fsync$readJson2.result,
		    name = pkg && pkg.name || config && config.name || _path2.default.basename(target);

		log.debug('Determined template "' + target + '" does exist and the name of the template is "' + name + '"');
		if (!pkg || !config) {
			log.warn('Target template "' + name + '" (' + target + ') does not have both a package.json and .enyoconfig file as required');
			return false;
		}

		if (templates[name]) {
			log.warn('A template by the name "' + name + '" is already registered on the system and cannot be added again');
			return false;
		} else {
			var dest = _path2.default.join(env.TEMPLATES, tmp()),
			    err = _utilExtra.fsync.link(target, dest);
			if (!err) {
				log.debug('Successfully linked the requested template from "' + target + '" to "' + dest + '"');
				return true;
			} else {
				log.debug('Failed to copy the requested template location from "' + target + '" to "' + dest + '"', err);
				log.warn('Failed to add the template "' + name + '" (' + target + ')');
				return false;
			}
		}
	} else {
		log.warn('The requested template "' + target + '" does not exist and cannot be added');
		return false;
	}
}

function remove(_ref3) {
	var opts = _ref3.opts,
	    env = _ref3.env,
	    log = _ref3.log;


	log.debug('Attempting to remove template "' + opts.target + '"');

	if (!checkUser(opts)) return false;
	if (!opts.target) {
		log.warn('Cannot remove a template without a "target"');
		return false;
	}

	var target = opts.target,
	    templates = getTemplates(env),
	    entry = templates[target],
	    defaultTpl = getDefaultTemplate(env),
	    stat = entry && _utilExtra.fsync.stat(entry.path),
	    err = void 0;

	if (!entry) log.warn('Cannot remove unknown template "' + target + '"');else {
		if (stat) {
			if (stat.isDirectory()) err = _utilExtra.fsync.removeDir(entry.path);else err = _utilExtra.fsync.unlink(entry.path);

			if (err) {
				log.debug('Failed to remove the requested template "' + target + '"', err);
				log.warn('Failed to remove the requested template "' + target + '"');
				return false;
			}

			log.debug('Successfully removed the requested template "' + target + '"');
		} else log.debug('Nothing to do, the path did not exist for "' + target + '" (' + entry.path + ')');
	}

	if (defaultTpl && defaultTpl == target) {
		log.debug('Removing the default template value since it was set to the currently removed template "' + target + '"');
		opts.target = '';
		return setDefault({ opts: opts, log: log, env: env });
	}

	return true;
}

function tmp() {
	var h = _crypto2.default.createHash('sha256');
	h.update(Math.random().toString());
	return h.digest('hex').slice(0, 16);
}

function install(_ref4) {
	var opts = _ref4.opts,
	    env = _ref4.env,
	    log = _ref4.log;


	if (!checkUser(opts)) return false;

	var target = opts.target,
	    action = opts.action,
	    isuri = (0, _utilExtra.isGitUri)(target),
	    parts = isuri ? (0, _utilExtra.parseGitUri)(target) : null,
	    templates = getTemplates(env),
	    dest = void 0;

	log.debug(parts, 'Attempting to install a template from a git uri "' + target + '"');

	if (!isuri) {
		log.warn('The requested install target "' + target + '" is not a valid URI');
		return false;
	}

	dest = _path2.default.join(env.TEMPLATES, tmp());

	return (0, _git2.default)({ source: parts.uri, target: parts.target, destination: dest, library: parts.name }).then(function () {
		// check to see if it is valid
		var lenv = (0, _env2.default)({ cwd: dest, user: false }, false),
		    name = lenv.local.package && lenv.local.package.name || lenv.local.config && lenv.local.config.name;
		if (!lenv.local.isProject || !name) {
			log.warn('The requested uri "' + parts.uri + '" is not a valid template, cleaning up');
			var err = _utilExtra.fsync.removeDir(dest);
			if (err) {
				log.debug('Failed to removed directory "' + dest + '" after failed attempt to install template, will need to remove manually', err);
				log.warn('Could not cleanup after installation of bad template, will need to cleanup manually "' + dest + '"');
			} else log.debug('Cleanup complete "' + dest + '"');
			return false;
		} else {
			if (templates[name]) {
				log.warn('There is already a template installed by the name "' + name + '", you will need remove one of them');
			} else log.debug('Successfully installed the git repository as a template "' + name + '"');
		}
	}).catch(function (e) {
		log.debug('Failed to install the requested uri "' + parts.uri + '"', e);
		log.warn('Failed to install the requested uri "' + parts.uri + '"');
	});
}

function list(_ref5) {
	var opts = _ref5.opts,
	    env = _ref5.env,
	    log = _ref5.log;

	// this is the lone operation that does not require no-script-safe
	var _getTemplatesList = getTemplatesList(env),
	    res = _getTemplatesList.list,
	    max = _getTemplatesList.max;

	log.debug('Listing ' + res.length + ' known templates');

	(0, _logger.stdout)('\nTemplates\n'.blue);
	(0, _logger.stdout)(res.map(function (t) {
		return '' + (0, _utilExtra.spaces)(4) + (t.name + (t.default ? '*' : '')) + (0, _utilExtra.spaces)(max - t.name.length + 4 - (t.default ? 1 : 0)) + (t.user ? 'local ' : 'system') + (0, _utilExtra.spaces)(4) + (t.data.library ? 'library' : 'app');
	}).join('\n').gray + '\n');
	return true;
}

function setDefault(_ref6) {
	var opts = _ref6.opts,
	    env = _ref6.env,
	    log = _ref6.log;


	if (!checkUser(opts)) return false;

	var target = opts.target || '',
	    templates = getTemplates(env),
	    curr = getDefaultTemplate(env) || '';

	if (!target) log.debug('Removing the default template configuration value');else if (!templates[target]) {
		// log.warn(`Cannot set the default template, "${target}" is not a known template`);
		log.warn('Could not set the default template value to "' + target + '" because it is not a known template');
		return false;
	} else if (curr && curr == target) {
		log.debug('No update necessary, the default is already "' + curr + '" (' + target + ')');
		return true;
	} else log.debug('Attempting to set the default template to "' + target + '" from "' + curr + '"');

	var err = env.user.setConfig('defaultTemplate', target);
	if (err) {
		log.debug('Failed to set the default template to "' + target + '" from "' + curr + '"', err);
		log.warn('Could not update the default template');
		return false;
	}
	log.debug('Successfully set the default template to "' + target + '" from "' + curr + '"');
	return true;
}

function getTemplates(env) {

	var ret = {},
	    usr = env.user.templates,
	    sys = env.system.templates;

	if (usr) Object.keys(usr).forEach(function (name) {
		return ret[name] = usr[name];
	});
	Object.keys(sys).forEach(function (name) {
		return ret[name] = sys[name];
	});

	return ret;
}

function getDefaultTemplate(env) {
	// this may return falsy which is ok and expected
	return env.user && env.user.config && env.user.config.defaultTemplate;
}

function getTemplatesList(env) {
	var list = [],
	    len = 0,
	    dtpl = getDefaultTemplate(env) || '';

	if (env.user && env.user.templates) {
		Object.keys(env.user.templates).forEach(function (t) {
			if (t.length > len) len = t.length;
			list.push({
				name: t,
				path: env.user.templates[t].path,
				user: true,
				data: env.user.templates[t].config,
				default: dtpl && dtpl == t
			});
		});
	}
	// now process whatever system defaults we've added
	Object.keys(env.system.templates).forEach(function (t) {
		if (t.length > len) len = t.length;
		list.push({
			name: t,
			path: env.system.templates[t].path,
			system: true,
			data: env.system.templates[t].config,
			default: dtpl && dtpl == t
		});
	});

	return { list: list, max: len };
}

exports.getTemplates = getTemplates;
exports.getDefaultTemplate = getDefaultTemplate;