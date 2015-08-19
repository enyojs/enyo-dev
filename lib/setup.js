'use strict';

var
	path = require('path');

var
	Promise = require('bluebird'),
	findIndex = require('find-index'),
	findLastIndex = require('find-index/last');

var
	env = require('./enyo/lib/env'),
	cm = require('./Packager/lib/cache-manager'),
	logger = require('./logger');

module.exports = Promise.method(function (opts) {
	opts = opts || {};
	// because this value is used during initialization of the environment we need to set it
	// earlier and ensure that the rest of the stack is using the correct values
	opts.package = resolve(opts.package || process.cwd());
	// since we are potentially redirecting another possible error case would be the config file
	if (opts.configFile) opts.configFile = resolve(process.cwd(), opts.configFile);
	// this will be reset, below to be the actual cwd for sanity
	opts.cwd = opts.package;
	return opts.__setup__ ? opts : env(opts).then(function (opts) {
		return configure(opts);
	});
});

function configure (opts) {
	
	// here we differentiate between the default values and those specified from the
	// command line and a .enyoconfig/package.json file to ensure that the one
	// requested by the tools later is the correct one
	
	// @note this was designed to allow existing code in the packager stream system to
	// continue to work and is less than ideal
	
	// there is a convoluted usecase here for this property as it was most likely set to the
	// "package" value earlier to allow env to setup with the correct configuration file
	// but the remaining use-case for it is differentiated as the literal cwd and package is used
	// where appropriate so we reset the value here
	opts.cwd = process.cwd();
	opts.name = defaults('name', opts) || path.basename(opts.package);
	opts.logLevel = string('logLevel', opts.logLevel, opts);
	opts.production = bool('production', opts.production, opts);
	opts.devMode = opts.production === true ? false : bool('devMode', opts.devMode, opts);
	if (opts.production === false && opts.devMode === false) opts.production = true;
	opts.cache = bool('cache', opts.cache, opts);
	opts.resetCache = bool('resetCache', opts.resetCache, opts);
	opts.trustCache = bool('trustCache', opts.trustCache, opts);
	// cli - relative to cwd, otherwise, package
	opts.cacheFile = clipath('cacheFile', opts.cacheFile, opts);
	opts.clean = bool('clean', opts.clean, opts);
	opts.sourceMaps = bool('sourceMaps', opts.sourceMaps, opts);
	opts.libDir = defaults('libDir', opts);
	// cli - relative to cwd, otherwise, package
	opts.paths = paths(opts);
	opts.strict = bool('strict', opts.strict, opts);
	opts.skip = array('skip', opts.skip, opts);
	opts.library = bool('library', opts.library, opts);
	opts.externals = opts.library === true ? false : bool('externals', opts.externals, opts);
	opts.wip = bool('wip', opts.wip, opts);
	opts.title = string('title', opts.title, opts) || opts.name;
	// cli - relative to cwd, otherwise, package
	opts.outdir = clipath('outdir', opts.outdir, opts);
	opts.outfile = string('outfile', opts.outfile, opts);
	opts.lessPlugins = lessPlugins(opts);
	opts.assetRoots = assetRoots(opts);
	opts.lessOnlyLess = bool('lessOnlyLess', opts.lessOnlyLess, opts);
	opts.minifyCss = opts.production ? opts.minifyCss !== false : bool('minifyCss', opts.minifyCss, opts);
	opts.inlineCss = bool('inlineCss', opts.inlineCss, opts);
	opts.outCssFile = string('outCssFile', opts.outCssFile, opts);
	opts.outJsFile = string('outJsFile', opts.outJsFile, opts);
	opts.inlineJs = bool('inlineJs', opts.inlineJs, opts);
	// cli - relative to cwd, otherwise, package
	opts.templateIndex = clipath('templateIndex', opts.templateIndex, opts);
	opts.watch = bool('watch', opts.watch, opts);
	// cli - relative to cwd, otherwise, package
	opts.watchPaths = clipaths('watchPaths', opts.watchPaths, opts);
	opts.polling = bool('polling', opts.polling, opts);
	opts.pollingInterval = number('pollingInterval', opts.pollingInterval, opts);
	opts.moduleDir = moduleDir(opts);
	
	logger.level(opts.logLevel);
	
	return Promise.resolve(opts.cache).then(function (cache) {
		if (typeof cache == 'boolean' && cache === true && !opts.resetCache) {
			return cm.readCache(opts.cacheFile).then(function (data) {
				opts.cache = Array.isArray(data) && data.length ? data : true;
			}, function (e) {
				logger.info({file: opts.cacheFile}, e.message);
			});
		}
	}).then(function () {
		Object.defineProperty(opts, '__setup__', {
			enumerable: false,
			configurable: false,
			writable: false,
			value: true
		});
	
		return opts;
	});
}

function bool (name, value, opts) {
	if (value !== undefined) return !! value;
	return !! defaults(name, opts);
}

function string (name, value, opts) {
	if (typeof value == 'string') return value;
	return defaults(name, opts);
}

function array (name, value, opts) {
	if (Array.isArray(value)) return value;
	return defaults(name, opts);
}

function number (name, value, opts) {
	if (!isNaN(value)) return value;
	return defaults(name, opts);
}

function resolve () {
	return path.resolve.apply(path, arguments);
}

function clipath (name, value, opts) {
	if (value && typeof value == 'string') {
		if (path.isAbsolute(value)) return value;
		return path.join(opts.cwd, value);
	} else {
		value = defaults(name, opts);
		if (value && typeof value == 'string') {
			if (path.isAbsolute(value)) return value;
			return path.join(opts.package, value);
		}
	}
}

function clipaths (name, value, opts) {
	var defs;
	value = resolveArrayOfPaths(value, opts.cwd);
	defs = resolveArrayOfPaths(defaults(name, opts), opts.package);
	return value.concat(defs).filter(function (p, i, array) {
		// ensure that if there are duplicates we only take the first entry for the duplicate
		return array.indexOf(p) === i;
	});
}

function resolveArrayOfPaths (array, root) {
	if (array && Array.isArray(array)) {
		return array.filter(function (p) {
			return p && typeof p == 'string';
		}).map(function (p) {
			return path.isAbsolute(p) ? p : path.resolve(root, p);
		});
	}
	return [];
}

function defaults (name, opts) {
	var l, u;
	l = opts.env.config.get(name);
	if (l !== undefined) return l;
	u = opts.env.user.get(name);
	if (u !== undefined) return u;
	return opts.env.system.defaults[name];
}

function paths (opts) {
	var ret, ldir;
	ret = clipaths('paths', opts.paths, opts);
	ldir = path.resolve(opts.package, opts.libDir);
	if (ret.indexOf(ldir) === -1) ret.push(ldir);
	return ret;
}

function assetRoots (opts) {
	var ret, fn, idx;
	
	if (Array.isArray(opts.assetRoots) && opts.assetRoots.length > 0) {
		ret = opts.assetRoots;
	} else {
		ret = defaults('assetRoots', opts);
	}
	
	if (ret.length > 0) {
		fn = function (e) { return e.name == '*'; };
		idx = findLastIndex(ret, fn);
		if (idx !== -1) {
			ret.all = ret[idx].path;
			ret.splice(idx, 1);
		}
		while ((idx = findIndex(ret, fn)) !== -1) {
			ret.splice(idx, 1);
		}
	}
	
	return ret;
}

function lessPlugins (opts) {
	var ret;
	
	if (Array.isArray(opts.lessPlugins) && opts.lessPlugins.length > 0) {
		ret = opts.lessPlugins;
	} else {
		ret = defaults('lessPlugins', opts);
	}
	
	if (ret.length > 0) {
		ret = ret.map(function (e) {
			try {
				e.plugin = require(e.name);
			} catch (err) {
				logger.fatal(err, 'could not find the requested Less plugin, ' + e.name);
				process.exit(-1);
			}

			return e;
		});
	}
	
	return ret;
}

function moduleDir (opts) {
	return path.join(opts.package, opts.env.package.get('moduleDir') || 'src');
}