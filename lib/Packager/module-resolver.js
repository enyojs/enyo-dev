'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = resolver;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _logger = require('../logger');

var _logger2 = _interopRequireDefault(_logger);

var _utilExtra = require('../util-extra');

var _utils = require('../utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var didSet = false,
    logBase = void 0;

var FAIL = Symbol('FAIL');
var INVALID = Symbol('INVALID');
var PATHS = Symbol('PATHS');

function getLog(opts) {
	if (!didSet) {
		logBase = (0, _logger2.default)(opts).child({ component: 'module-resolver' });
		didSet = true;
	}
	return logBase;
}

function resolver() {
	// allows a single, reuseable instance of the resolver with a local cache
	// that is easily reset by requesting a new resolver
	return RESOLVE.bind(null, {});
}

/*
Entry point for all resolution of paths. Returns false if the module could not be resolved otherwise
returns an object hash with information about the module including its raw contents.
*/
function RESOLVE(cache, _ref) {
	var _ref$opts = _ref.opts,
	    opts = _ref$opts === undefined ? {} : _ref$opts,
	    target = _ref.target,
	    _ref$cwd = _ref.cwd,
	    cwd = _ref$cwd === undefined ? opts.cwd || process.cwd() : _ref$cwd,
	    _ref$paths = _ref.paths,
	    paths = _ref$paths === undefined ? [] : _ref$paths;


	var log = getLog(opts).child({ target: target, cwd: cwd }),
	    result = void 0;

	log.level(opts.logLevel || 'warn');

	if (!target || typeof target != 'string') {
		log.warn('Cannot resolve unknown or invalid target');
		return false;
	}

	log.trace('Resolving "' + target + '"');

	// the difference here is that an "external" module is one not referenced by a relative
	// path - external can refer to a module from CJS package and node_modules or from a library
	if ((0, _utils.isExternal)(target)) {
		result = RESOLVE_EXTERNAL(target, cwd, log, cache, opts, Array.from(paths));
	} else {
		result = RESOLVE_PATH(target, cwd, log, cache, opts);
	}

	return result === FAIL || result === INVALID ? false : result;
}

/*
*/
function RESOLVE_PATH(target, cwd, log, cache, opts) {

	log.trace({ function: 'RESOLVE_PATH' }, 'Resolving path target "' + target + '" from "' + cwd + '"');

	// attempt to resolve the path as a file module and if that fails fallback
	// to checking for a package
	var fullpath = _path2.default.isAbsolute(target) ? target : _path2.default.join(cwd, target),
	    result = void 0;

	result = RESOLVE_FILE(fullpath, log, cache, opts);
	if (result === FAIL || result === INVALID) {
		result = RESOLVE_PACKAGE(fullpath, log, cache, opts);
		if (result === FAIL || result === INVALID) {
			// prevent expanding the path when the target module is specified relatively
			if (fullpath > cwd && !(0, _utils.isRelative)(target)) {
				var base = _path2.default.dirname(fullpath),
				    exp = EXPAND(base, log, cache, opts, cwd);
				if (exp !== INVALID && exp !== FAIL) {
					fullpath = _path2.default.join(exp, _path2.default.basename(fullpath));
					log.trace({ function: 'RESOLVE_PATH' }, 'Using expanded path "' + fullpath + '" to search for package');
					result = RESOLVE_FILE(fullpath, log, cache, opts);
					if (result === FAIL || result === INVALID) result = RESOLVE_PACKAGE(fullpath, log, cache, opts);
				}
			}
		}
	}
	if (result === FAIL || result === INVALID) {
		log.trace({ function: 'RESOLVE_PATH' }, 'Failed to resolve path target "' + target + '" from "' + cwd + '"');
		return result;
	}

	log.trace({ function: 'RESOLVE_PATH' }, 'Successfully resolved path target "' + target + '"');
	return result;
}

/*
*/
function RESOLVE_EXTERNAL(target, cwd, log, cache, opts, paths) {

	log.trace({ function: 'RESOLVE_EXTERNAL' }, 'Resolving external module "' + target + '" from "' + cwd + '"');

	// first we check the cache
	var result = cache[target],
	    base = opts.package || opts.cwd || process.cwd();

	if (result) {
		log.trace({ function: 'RESOLVE_EXTERNAL' }, 'Using cached entry for external module "' + target + '"');
		return result;
	}

	// now we take the time to check for valid CJS node_modules inclusion
	result = RESOLVE_NODE_MODULE(target, cwd, log, cache, opts);
	if (result !== INVALID && result !== FAIL) {
		log.trace({ function: 'RESOLVE_EXTERNAL' }, 'Successfully resolved CommonJS module "' + target + '" from "' + result.fullpath + '"');
		cache[target] = result;
		return result;
	}

	log.trace({ function: 'RESOLVE_EXTERNAL' }, 'Could not resolve "' + target + '" as a CommonJS module');

	if (!paths || !paths.length) {
		log.trace({ function: 'RESOLVE_EXTERNAL' }, 'No additional paths to search');
		return FAIL;
	}

	for (var i = 0; i < paths.length; ++i) {
		var lib = paths[i];
		if (!_path2.default.isAbsolute(lib)) lib = _path2.default.resolve(base, lib);
		log.trace({ function: 'RESOLVE_EXTERNAL' }, 'Attempting to resolve "' + target + '" via path "' + lib + '"');
		result = RESOLVE_PATH(target, lib, log, cache, opts);
		if (result !== FAIL && result !== INVALID) {
			log.trace({ function: 'RESOLVE_EXTERNAL' }, 'Successfully found module "' + target + '" via path "' + lib + '"');
			cache[target] = result;
			// this is ugly but to keep things working without rewriting the whole stream
			result.lib = _path2.default.join(lib, target.split('/').shift());
			result.libName = _path2.default.basename(result.lib);
			return result;
		}
	}

	log.trace({ function: 'RESOLVE_EXTERNAL' }, 'Could not find "' + target + '" as a CommonJS module or via any given paths');
	return FAIL;
}

/*
*/
function RESOLVE_FILE(target, log, cache, opts) {

	log.trace({ function: 'RESOLVE_FILE' }, 'Resolving file "' + target + '"');

	// we first attempt to resolve the file as requested
	// if that fails we attempt, if necessary, to add the .js suffix to it

	var file = target,
	    ext = _path2.default.extname(target),
	    result = void 0;

	result = LOAD_FILE(file, log, cache);
	if (result === FAIL) {
		// since it failed, we can try again with the extension if it doesn't already have it
		if (!ext) {
			file = target + '.js';
			log.trace({ function: 'RESOLVE_FILE' }, 'Attempting to resolve "' + target + '" with .js extension');
			result = LOAD_FILE(file, log, cache);
			if (result !== FAIL && result !== INVALID) {
				log.trace({ function: 'RESOLVE_FILE' }, 'Successfully found module for "' + target + '" at "' + file + '"');
				cache[target] = result;
				return result;
			} else log.trace({ function: 'RESOLVE_FILE' }, 'Failed to find module for "' + target + '" with "' + file + '"');
		}

		return result;
	} else if (result === INVALID) {
		log.trace({ function: 'RESOLVE_FILE' }, 'Invalid object-type found for path "' + target + '"');
		return INVALID;
	} else {
		log.trace({ function: 'RESOLVE_FILE' }, 'Successfully found the module for file path "' + target + '"');
		return result;
	}
}

/*
*/
function LOAD_FILE(target, log, cache) {

	log.trace({ function: 'LOAD_FILE' }, 'Loading file "' + target + '"');

	var result = cache[target],
	    stat = void 0,
	    contents = void 0;

	if (result) {
		log.trace({ function: 'LOAD_FILE' }, 'Using cached entry for file "' + target + '"');
		return result;
	}

	stat = _utilExtra.fsync.stat(target);
	if (stat) {
		if (stat.isFile()) {
			log.trace({ function: 'LOAD_FILE' }, 'Found and loading the file "' + target + '"');
			return cache[target] = {
				isFile: true,
				contents: _utilExtra.fsync.readFile(target, 'utf8').result,
				mtime: stat.mtime.getTime(),
				fullpath: target
			};
		} else {
			log.trace({ function: 'LOAD_FILE' }, 'Path "' + target + '" is not a file');
			return INVALID;
		}
	} else {
		log.trace({ function: 'LOAD_FILE' }, 'Could not stat the file "' + target + '"');
		return FAIL;
	}
}

/*
*/
function RESOLVE_PACKAGE(target, log, cache, opts) {

	log.trace({ function: 'RESOLVE_PACKAGE' }, 'Resolving package "' + target + '"');

	var result = cache[target];

	if (result) {
		if (result.isPackage) {
			log.trace({ function: 'RESOLVE_PACKAGE' }, 'Using cached entry for package "' + target + '"');
			return result;
		} else {
			log.trace({ function: 'RESOLVE_PACKAGE' }, 'There was a non-package entry cached for "' + target + '"');
			return FAIL;
		}
	}

	result = RESOLVE_DIRECTORY(target, log, cache, opts);
	if (result === FAIL || result === INVALID) {
		log.trace('Unable to resolve package for "' + target + '"');
		return result;
	}

	// it will already be cached at this point by the RESOLVE_DIRECTORY method
	if (result.isPackage) {
		var mainf = _path2.default.join(result.fullpath, result.json.main || 'index.js'),
		    main = RESOLVE_FILE(mainf, log, cache, opts);
		if (main === FAIL || main === INVALID) {
			log.trace({ function: 'RESOLVE_PACKAGE' }, 'Could not resolve "main" file for package "' + result.fullpath + '"');
			return result;
		}
		result.main = main.fullpath;
		result.mtime[main.fullpath] = main.mtime;
		result.contents = main.contents;

		log.trace({ function: 'RESOLVE_PACKAGE' }, 'Checking to see if the package has a valid node_modules directory');
		var stat = _utilExtra.fsync.stat(_path2.default.join(result.fullpath, 'node_modules'));
		if (stat && stat.isDirectory()) {
			log.trace({ function: 'RESOLVE_PACKAGE' }, 'The package "' + result.fullpath + '" does have a valid node_modules directory');
			result.nodeModules = true;
		} else {
			log.trace({ function: 'RESOLVE_PACKAGE' }, 'The package "' + result.fullpath + '" does not have a valid node_modules directory');
			result.nodeModules = false;
		}

		log.trace({ function: 'RESOLVE_PACKAGE' }, 'Successfully loaded package "' + target + '" from "' + result.fullpath + '"');
		return result;
	} else {
		log.trace({ function: 'RESOLVE_PACKAGE' }, 'The path "' + target + '" is a directory but not a package');
		return FAIL;
	}
}

/*
*/
function RESOLVE_DIRECTORY(target, log, cache, opts) {

	log.trace({ function: 'RESOLVE_DIRECTORY' }, 'Resolving directory "' + target + '"');

	var result = cache[target],
	    stat = void 0;

	if (result) {
		if (result.isDirectory) {
			log.trace({ function: 'RESOLVE_DIRECTORY' }, 'Using cached entry for directory "' + target + '"');
			return result;
		} else {
			log.trace({ function: 'RESOLVE_DIRECTORY' }, 'Found cached entry for "' + target + '" that is not a directory');
			return INVALID;
		}
	}

	stat = _utilExtra.fsync.stat(target);
	if (stat) {
		if (stat.isDirectory() || stat.isSymbolicLink()) {
			result = cache[target] = {
				isDirectory: true,
				fullpath: target
			};

			log.trace({ function: 'RESOLVE_DIRECTORY' }, 'Attempting to locate a package.json file');

			var pfile = _path2.default.join(target, 'package.json');
			stat = _utilExtra.fsync.stat(pfile);
			if (stat && stat.isFile()) {
				log.trace({ function: 'RESOLVE_DIRECTORY' }, 'Found a package.json file');
				result.isPackage = true;
				result.packageFile = pfile;
				result.mtime = {};
				result.mtime[pfile] = stat.mtime.getTime();

				var _fsync$readJson = _utilExtra.fsync.readJson(pfile),
				    json = _fsync$readJson.result,
				    err = _fsync$readJson.error;

				if (err) {
					log.trace('Failed to parse package file "' + pfile + '"', err);
					json = {};
				}
				result.json = json;
			} else log.trace({ function: 'RESOLVE_DIRECTORY' }, 'Could not resolve the package.json file');
			return result;
		}
	} else {
		log.trace({ function: 'RESOLVE_DIRECTORY' }, 'Failed to stat directory "' + target + '"');
		return FAIL;
	}
}

/*
*/
function EXPAND(target, log, cache, opts, cwd) {

	log.trace({ function: 'EXPAND' }, 'Expanding path "' + target + '"');

	var root = cwd || opts.package || opts.cwd || process.cwd(),
	    base = _path2.default.relative(root, target),
	    steps = base.split(_path2.default.sep),
	    step = root,
	    result = void 0;

	log.trace({ function: 'EXPAND', target: target, root: root, base: base, steps: steps });

	while (steps.length) {
		var dir = steps.shift();
		step = _path2.default.join(step, dir);
		result = RESOLVE_PACKAGE(step, log, cache, opts);
		if (result === INVALID) {
			log.trace({ function: 'EXPAND' }, 'Path "' + step + '" resulted in an invalid response, cannot expand path "' + target + '"');
			return INVALID;
		} else if (result === FAIL) {
			// it might be a valid directory which is still useful
			result = RESOLVE_DIRECTORY(step, log, cache, opts);
			if (result === FAIL || result === INVALID) {
				log.trace({ function: 'EXPAND' }, 'Unable to expand path "' + target + '" failed at step "' + step + '"');
				return result;
			}
		}
		if (result.json) {
			var moduleDir = result.json.moduleDir;
			if (!moduleDir) {
				var parent = _path2.default.join(step, '..');
				if (opts.paths.indexOf(parent) > -1) {
					// default moduleDir for libraries is 'src'
					moduleDir = 'src';
				}
			}
			if (moduleDir) {
				log.trace({ function: 'EXPAND' }, 'Expanding step "' + step + '" with "moduleDir" "' + result.json.moduleDir + '"');
				step = _path2.default.join(step, moduleDir);
			}
		}
	}

	if (step != target) log.trace({ function: 'EXPAND' }, 'Expanded path "' + target + '" to "' + step + '"');
	return step;
}

/*
*/
function RESOLVE_NODE_MODULE(target, cwd, log, cache, opts) {

	log.trace({ function: 'RESOLVE_NODE_MODULE' }, 'Resolving CommonJS module "' + target + '" via normal means from "' + cwd + '"');

	var root = opts.package || opts.cwd || process.cwd(),
	    steps = _path2.default.relative(root, cwd).split(_path2.default.sep),
	    step = _path2.default.resolve(root, cwd),
	    lastLoop = false,
	    result = void 0;

	do {
		log.trace({ function: 'RESOLVE_NODE_MODULE' }, 'Attempting with step "' + step + '"');
		result = RESOLVE_PACKAGE(step, log, cache, opts);
		if (result === FAIL) result = RESOLVE_DIRECTORY(step, log, cache, opts);
		if (result === FAIL || result === INVALID) {
			log.trace({ function: 'RESOLVE_NODE_MODULE' }, 'Unable to resolve step "' + step + '" as package or directory, bailing');
			return INVALID;
		}
		if (result.isPackage && result.nodeModules) {
			log.trace({ function: 'RESOLVE_NODE_MODULE' }, 'Checking for "' + target + '" in package "' + step + '"');
			result = RESOLVE_PATH(target, _path2.default.join(step, 'node_modules'), log, cache, opts);
			if (result !== FAIL && result !== INVALID) {
				log.trace({ function: 'RESOLVE_NODE_MODULE' }, 'Acquired module from path "' + result.fullpath + '"');
				cache[target] = result;
				return result;
			}
		}
		steps.pop();
		step = _path2.default.join(root, steps.join(_path2.default.sep));
		if (step == root && !lastLoop) lastLoop = true;else lastLoop = false;
	} while (steps.length || lastLoop);

	log.trace({ function: 'RESOLVE_NODE_MODULE' }, 'Could not find a CommonJS node_modules entry for "' + target + '"');
	return FAIL;
}