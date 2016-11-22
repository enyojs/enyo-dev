'use strict';

/*
The existence of this file is evidence of a failed attempt to converge 2 different architectural design
paths and too little time to correct it. This function is required to process the options before they
are passed to the Packager or Watcher instances to normalize the options whether being used from the
command-line commands or imperative API exposed by the module.
*/

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = setup;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _last = require('find-index/last');

var _last2 = _interopRequireDefault(_last);

var _env = require('./enyo/lib/env');

var _env2 = _interopRequireDefault(_env);

var _utilExtra = require('./util-extra');

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _cacheManager = require('./Packager/lib/cache-manager');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var log = void 0;

function setup() {
	var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

	log = (0, _logger2.default)(opts).child({ component: 'setup' });
	// we have to ensure that the requested "package" exists so that should there be a configuration
	// file already the environment setup routine correctly reads it
	opts.package = opts.package ? _path2.default.resolve(opts.package) : process.cwd();
	var stat = _utilExtra.fsync.stat(opts.package);
	log.level(opts.logLevel || 'warn');
	if (!stat) (0, _logger.fatal)('The requested package "' + opts.package + '" does not exist');else if (!stat.isDirectory()) (0, _logger.fatal)('The requested package "' + opts.package + '" is not a directory');
	opts.cwd = opts.package;
	return configure({ opts: opts, env: (0, _env2.default)(opts), log: log });
}

function configure(_ref) {
	var opts = _ref.opts,
	    env = _ref.env,
	    log = _ref.log;

	if (!env.local.isProject) (0, _logger.fatal)('The requested package "' + opts.package + '" is not a project');

	// there is nothing ideal about this implementation, it should not even exist
	opts.cwd = process.cwd();
	opts.name = string('name', opts.name, env) || _path2.default.basename(opts.package);
	opts.logLevel = opts.logLevel || 'warn';
	opts.production = bool('production', opts.production, env);
	opts.devMode = opts.production === true ? false : bool('devMode', opts.devMode, env);
	if (opts.production === false && opts.devMode === false) opts.production = true;
	opts.cache = bool('cache', opts.cache, env);
	// even though the option is gone we set this for consistency
	opts.cacheFile = _path2.default.join(opts.package, '.enyocache');
	opts.resetCache = bool('resetCache', opts.resetCache, env);
	opts.trustCache = bool('trustCache', opts.trustCache, env);
	opts.clean = bool('clean', opts.clean, env);
	opts.sourceMaps = bool('sourceMaps', opts.sourceMaps, env);
	opts.libDir = defaults('libDir', env);
	opts.paths = paths(opts, env);
	opts.strict = bool('strict', opts.strict, env);
	opts.skip = array('skip', opts.skip, env);
	opts.library = bool('library', opts.library, env);
	opts.externals = opts.library === true ? false : bool('externals', opts.externals, env);
	opts.wip = bool('wip', opts.wip, env);
	opts.title = string('title', opts.title, env) || opts.name;
	opts.outDir = clipath('outDir', opts.outDir, opts, env);
	opts.outFile = string('outFile', opts.outFile, env);
	opts.lessPlugins = lessPlugins(opts, env);
	opts.assetRoots = assetRoots(opts, env);
	opts.lessOnlyLess = bool('lessOnlyLess', opts.lessOnlyLess, env);
	opts.minifyCss = opts.production ? opts.minifyCss !== false : bool('minifyCss', opts.minifyCss, env);
	opts.inlineCss = bool('inlineCss', opts.inlineCss, env);
	opts.outJsFile = string('outJsFile', opts.outJsFile, env);
	opts.inlineJs = bool('inlineJs', opts.inlineJs, env);
	opts.templateIndex = clipath('templateIndex', opts.templateIndex, opts, env);
	opts.watch = bool('watch', opts.watch, env);
	opts.polling = bool('polling', opts.polling, env);
	opts.pollingInterval = number('pollingInterval', opts.pollingInterval, env);
	opts.moduleDir = moduleDir(opts, env);
	opts.headScripts = clipaths('headScripts', opts.headScripts, opts, env);
	opts.tailScripts = clipaths('tailScripts', opts.tailScripts, opts, env);
	opts.promisePolyfill = bool('promisePolyfill', opts.promisePolyfill, env);
	opts.styleOnly = bool('styleOnly', opts.styleOnly, env);
	opts.outCssFile = outCssFile(opts, env);
	opts.lessVars = lessVars(opts.lessVars, env);

	// because the packager and watcher want the cache to be an object...
	if (opts.cache === true && !opts.resetCache) {
		// @TODO: Needs to validate the cache but the function was async and needs to be converted...
		var result = (0, _cacheManager.readCache)(opts.cacheFile, opts);
		if (result && result instanceof Error) {
			log.trace('Failed to read or validate the cache file "' + opts.cacheFile + '"', result);
		} else {
			opts.cache = result;
		}
	}

	log.trace('Setup (property normalization) complete');
	return { opts: opts, env: env };
}

function bool(name, value, env) {
	if (value !== undefined) return !!value;
	return !!defaults(name, env);
}

function string(name, value, env) {
	if (typeof value == 'string') return value;
	return defaults(name, env);
}

function array(name, value, env) {
	if (Array.isArray(value)) return value;
	return defaults(name, env);
}

function number(name, value, env) {
	if (!isNaN(value)) return value;
	return defaults(name, env);
}

function outCssFile(opts, env) {
	if (opts.styleOnly && opts.library) return typeof opts.outCssFile == 'string' ? opts.outCssFile : null;else return string('outCssFile', opts.outCssFile, env);
}

function clipath(name, value, opts, env) {
	if (value && typeof value == 'string') {
		if (_path2.default.isAbsolute(value)) return value;
		return _path2.default.join(opts.cwd, value);
	} else {
		value = defaults(name, env);
		if (value && typeof value == 'string') {
			if (_path2.default.isAbsolute(value)) return value;
			return _path2.default.join(opts.package, value);
		}
	}
}

function clipaths(name, value, opts, env) {
	var values = resolveArrayOfPaths(value, opts.cwd),
	    defs = resolveArrayOfPaths(defaults(name, env), opts.package);
	return values.concat(defs).filter(function (p, i, arr) {
		return arr.indexOf(p) === i;
	});
}

function resolveArrayOfPaths(array, root) {
	if (array && Array.isArray(array)) {
		return array.filter(function (p) {
			return p && typeof p == 'string';
		}).map(function (p) {
			return _path2.default.isAbsolute(p) ? p : _path2.default.resolve(root, p);
		});
	}
	return [];
}

function defaults(name, env) {
	return env.getConfig(name);
}

function paths(opts, env) {
	var p = clipaths('paths', typeof opts.paths == 'string' ? opts.paths.split(',') : opts.paths, opts, env),
	    l = _path2.default.resolve(opts.package, opts.libDir);
	if (p.indexOf(l) === -1) p.push(l);
	return p;
}

function assetRoots(opts, env) {
	var roots = void 0;
	if (Array.isArray(opts.assetRoots) && opts.assetRoots.length) roots = opts.assetRoots;else roots = defaults('assetRoots', env);
	if (roots.length) {
		var i = (0, _last2.default)(roots, function (r) {
			return r.name == '*';
		});
		if (i > -1) {
			roots.all = roots[i].path;
			roots.splice(i, 1);
		}
		while ((i = roots.findIndex(function (r) {
			return r.name == '*';
		})) > -1) {
			roots.splice(i, 1);
		}
	}
	return roots;
}

function lessPlugins(opts, env) {
	var plugs = void 0;
	if (Array.isArray(opts.lessPlugins) && opts.lessPlugins.length) plugs = opts.lessPlugins;else plugs = defaults('lessPlugins', env);
	if (plugs.length) {
		return plugs.map(function (p) {
			try {
				p.plugin = require(p.name);
			} catch (e) {
				log.trace('Failed to find the requested less plugin "' + p.name + '"', e);
				(0, _logger.fatal)('Failed to find the requested less plugin "' + p.name + '"');
			}
			return p;
		});
	}
	return plugs;
}

function lessVars(vars, env) {
	var ret = vars && Array.isArray(vars) ? vars : [];
	ret = ret.concat(defaults('lessVars', env));
	return ret.filter(function (r) {
		return (typeof r === 'undefined' ? 'undefined' : _typeof(r)) == 'object' && r.name && r.hasOwnProperty('value');
	});
}

function moduleDir(opts, env) {
	return _path2.default.join(opts.package, env.local.package && env.local.package.moduleDir || 'src');
}