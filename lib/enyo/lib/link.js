'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.linkLocal = exports.getLocal = exports.getLinkable = undefined;
exports.default = link;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _colors = require('colors');

var _colors2 = _interopRequireDefault(_colors);

var _utilExtra = require('../../util-extra');

var _logger = require('../../logger');

var _logger2 = _interopRequireDefault(_logger);

var _env = require('./env');

var _env2 = _interopRequireDefault(_env);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var didSet = false,
    logBase = void 0;

function getLog(opts) {
	if (!didSet) {
		logBase = (0, _logger2.default)(opts).child({ component: 'link' });
		logBase.level(opts.logLevel || 'warn');
		didSet = true;
	}
	return logBase;
}

function checkUser(opts) {
	var log = getLog(opts);
	if (opts.user === false) {
		log.warn('Cannot manage links in non-user mode');
		return false;
	}
	return true;
}

function link(_ref) {
	var opts = _ref.opts,
	    env = _ref.env;

	if (opts.listLinkable) return printLinkable({ opts: opts, env: env });else if (opts.listLocal) return printLocal({ opts: opts, env: env });else if (opts.target) return linkLocal({ opts: opts, env: env });else return makeLinkable({ opts: opts, env: env });
}

function printLinkable(_ref2) {
	var opts = _ref2.opts,
	    env = _ref2.env;

	var links = void 0,
	    max = void 0;
	if (!checkUser(opts)) return false;

	var _getLinkable = getLinkable({ opts: opts, env: env });

	links = _getLinkable.links;
	max = _getLinkable.max;

	print(links, 'Links', max);
}

function printLocal(_ref3) {
	var opts = _ref3.opts,
	    env = _ref3.env;

	var links = void 0,
	    max = void 0,
	    valid = void 0;
	if (!checkUser(opts)) return false;

	var _getLocal = getLocal({ opts: opts, env: env });

	links = _getLocal.links;
	max = _getLocal.max;
	valid = _getLocal.valid;

	if (valid) print(links, 'Local Links', max);
}

function print(links, header, max) {
	(0, _logger.stdout)(('\n' + header + '\n').blue);
	if (links.length === 0) (0, _logger.stdout)(((0, _utilExtra.spaces)(4) + 'No linked libraries\n').gray);else (0, _logger.stdout)(links.map(function (l) {
		return '' + (0, _utilExtra.spaces)(4) + l.name + (0, _utilExtra.spaces)(max - l.name.length + 4) + l.path;
	}).join('\n').gray + '\n');
}

function getLinkable(_ref4) {
	var opts = _ref4.opts,
	    env = _ref4.env;

	return getLinks({ opts: opts, target: env.LINKS });
}

function getLocal(_ref5) {
	var opts = _ref5.opts,
	    env = _ref5.env;

	var log = getLog(opts),
	    target = opts.target && _path2.default.resolve(opts.target) || env.cwd,
	    libDir = void 0,
	    lenv = void 0,
	    res = void 0;

	if (target && target != env.cwd) {
		lenv = (0, _env2.default)({ cwd: target }, false);
	} else lenv = env;

	if (!lenv.local.isProject) {
		log.warn('Cannot read local links, ' + (target || env.cwd) + ' is not a project');
		return { valid: false };
	}

	if (lenv.local.config && lenv.local.config.library) {
		log.warn('Cannot read local links, ' + (target || env.cwd) + ' is a library');
		return { valid: false };
	}

	libDir = _path2.default.join(target || lenv.cwd, lenv.getConfig('libDir'));

	res = getLinks({ opts: opts, target: libDir });
	res.valid = true;
	return res;
}

function getLinks(_ref6) {
	var opts = _ref6.opts,
	    target = _ref6.target;

	var links = [],
	    max = 0,
	    log = getLog(opts);

	if (opts.user !== false) {
		var _fsync$readDir = _utilExtra.fsync.readDir(target),
		    result = _fsync$readDir.result,
		    error = _fsync$readDir.error;

		if (error) log.debug('Failed to read links from path "' + target + '"', error);else result.map(function (l) {
			return _path2.default.join(target, l);
		}).filter(function (l) {
			var stat = _utilExtra.fsync.stat(l);
			return stat ? stat.isSymbolicLink() : false;
		}).forEach(function (l) {
			// need to convert this to a full path (to link)
			// retrieve the real path of the link
			// read configurations to attempt to get the actual name of the linked project
			var lpath = l,
			    rpath = _utilExtra.fsync.realpath(lpath),
			    _fsync$readJson = _utilExtra.fsync.readJson(_path2.default.join(rpath, '.enyoconfig')),
			    cfg = _fsync$readJson.result,
			    _fsync$readJson2 = _utilExtra.fsync.readJson(_path2.default.join(rpath, 'package.json')),
			    pkg = _fsync$readJson2.result,
			    name = pkg && pkg.name || cfg && cfg.name;


			if (!name) {
				log.debug('Could not retrieve a valid "name" for linked library "' + lpath + '" (' + rpath + '), skipping');
				return;
			}

			if (name.length > max) max = name.length;
			links.push({ name: name, path: rpath, linkPath: lpath, package: pkg, config: cfg });
		});
	}
	return { links: links, max: max };
}

function linkLocal(_ref7) {
	var opts = _ref7.opts,
	    env = _ref7.env;


	if (!checkUser(opts)) return false;

	var target = opts.target,
	    log = getLog(opts),
	    libDir = _path2.default.join(env.cwd, env.getConfig('libDir')),
	    force = !!opts.force,
	    links = void 0,
	    failed = false;

	if (!env.local.isProject) {
		log.warn('Cannot link "' + target + '", "' + env.cwd + '" is not a project');
		return false;
	}

	if (!target && typeof target != 'string' && !Array.isArray(target)) {
		log.warn('Invalid target, cannot link "' + target + '"');
		return false;
	}

	var err = _utilExtra.fsync.ensureDir(libDir);
	if (err) {
		log.trace('Failed to ensure libDir "' + libDir + '"', err);
		log.warn('Unable to ensure the target library directory is available "' + libDir + '"');
		return false;
	}

	target = typeof target == 'string' ? target.split(',').map(function (l) {
		return l.trim();
	}) : target;

	var _getLinkable2 = getLinkable({ opts: opts, env: env });

	links = _getLinkable2.links;

	target.forEach(function (l) {
		var entry = links.find(function (e) {
			return e.name == l;
		});
		if (!entry) {
			log.warn('Unable to find a link source for "' + l + '"');
			failed = true;
			return;
		}
		// to make this link to the real path use entry.path, but the original idea is the double link
		// so it can be swapped without needing to relink all projects
		if (!makeLink({ opts: opts, from: entry.linkPath, to: _path2.default.join(libDir, entry.name), force: force })) {
			log.debug('Failed to create link for "' + l + '"');
			failed = true;
		}
	});

	return !failed;
}

function makeLinkable(_ref8) {
	var opts = _ref8.opts,
	    env = _ref8.env;

	var log = getLog(opts),
	    isLibrary = env.local.isProject && env.local.config && env.local.config.library,
	    force = !!opts.force,
	    name = void 0,
	    stat = void 0,
	    to = void 0;

	if (!checkUser(opts)) return false;
	if (!isLibrary) {
		log.warn('Cannot make a non-library linkable');
		return false;
	}

	name = env.local.package && env.local.package.name || env.local.config && env.local.config.name;
	if (!name) {
		log.warn('Cannot link library "' + env.cwd + '", could not determine the project name');
		return false;
	}

	to = _path2.default.join(env.LINKS, name);
	stat = _utilExtra.fsync.stat(to);
	if (stat) {
		if (!force) {
			log.warn('Cannot link library, a system link for a library named "' + name + '" already exists (' + to + ') and the force flag was not set');
			return false;
		} else {
			log.warn('Replacing existing system link for library "' + name + '" because the force flag was true');
		}
	}

	if (!makeLink({ opts: opts, from: env.cwd, to: to, force: force })) {
		log.warn('Failed to make "' + env.cwd + '" linkable');
	}
}

function makeLink(_ref9) {
	var opts = _ref9.opts,
	    from = _ref9.from,
	    to = _ref9.to,
	    force = _ref9.force;

	var log = getLog(opts),
	    stat = _utilExtra.fsync.stat(to);

	log.debug('Attempting to make a link from "' + from + '" to "' + to + '" and the target ' + (stat ? 'already exists' : 'does not exist'));

	if (!stat || force) {
		if (stat) {
			log.debug('Target path "' + to + '" exists and force is true, removing before linking');
			if (!remove({ opts: opts, target: to })) return false;
		}
		var err = _utilExtra.fsync.link(from, to);
		if (err) {
			log.debug('Failed during linking for "' + from + '" to "' + to + '"', err);
			return false;
		}
	} else if (stat) {
		log.debug('Cannot create link from "' + from + '" to "' + to + '" because it already exists, use the "force" flag');
		return false;
	}
	return true;
}

function remove(_ref10) {
	var opts = _ref10.opts,
	    target = _ref10.target;

	var log = getLog(opts),
	    stat = _utilExtra.fsync.stat(target),
	    err = void 0;
	if (stat) {
		if (stat.isDirectory()) {
			log.debug('Removal target "' + target + '" is a directory');
			err = _utilExtra.fsync.removeDir(target);
			if (err) {
				log.debug('Failed to remove directory "' + target + '"', err);
				return false;
			}
		} else if (stat.isFile()) {
			log.debug('Removal target "' + target + '" is a file');
			err = _utilExtra.fsync.removeFile(target);
			if (err) {
				log.debug('Failed to remove file "' + target + '"', err);
				return false;
			}
		} else if (stat.isSymbolicLink()) {
			log.debug('Removal target "' + target + '" is a symbolic link');
			err = _utilExtra.fsync.unlink(target);
			if (err) {
				log.debug('Failed to unlink "' + target + '"', err);
				return false;
			}
		}
	} else log.debug('The requested removal target "' + target + '" did not exist');
	return true;
}

exports.getLinkable = getLinkable;
exports.getLocal = getLocal;
exports.linkLocal = linkLocal;