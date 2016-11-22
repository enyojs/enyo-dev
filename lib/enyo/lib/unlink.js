'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = unlink;

var _env2 = require('./env');

var _env3 = _interopRequireDefault(_env2);

var _link = require('./link');

var _utilExtra = require('../../util-extra');

var _logger = require('../../logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function unlink(_ref) {
	var opts = _ref.opts;


	var log = (0, _logger2.default)(opts).child({ component: 'unlink' });
	log.level(opts.logLevel || 'warn');

	// unlike in other tools we really can't do much with an 'env' until we know
	// what path to explore
	if (!opts.target) {
		log.debug('No target was provided, checking current working directory to see if we are in a library');
		// in this case the only way it can be useful is if we are currently in a library
		// the global flag doesn't matter it is assumed
		var env = (0, _env3.default)(opts),
		    name = env.local.package && env.local.package.name || env.local.config && env.local.config.name;

		if (!name) {
			log.warn('The current working directory "' + env.cwd + '" is a library but does not have a project name, it cannot be unlinked');
			return false;
		}

		if (env.local.isProject) {
			if (env.local.config && env.local.config.library) {
				log.debug('Current working directory "' + env.cwd + '" is a library');
				return unlinkGlobal({ opts: opts, env: env, log: log, names: [name] });
			}
		}
		log.debug('Current working directory "' + env.cwd + '" is not a library, it cannot be unlinked');
		// not technically a failure
		return true;
	} else {

		var target = opts.target,
		    project = opts.project,
		    _env = void 0;

		// if the global flag is set we interpret the other flags and options differently
		if (opts.global) {

			target = processTarget(target);
			_env = (0, _env3.default)(opts);

			if (opts.unlinkAll) {
				log.debug('The global and unlink all options are set');
				return unlinkAllGlobal({ opts: opts, env: _env, log: log });
			} else {
				// the project option can be ignored because it is global but we need to handle the target
				// the same as usual
				log.debug('The global option was set');
				return unlinkGlobal({ opts: opts, env: _env, log: log, names: target });
			}
		} else {

			if (opts.unlinkAll) {
				log.debug('The unlink all flag was set');
				project = target;
				if (project) {

					if (typeof project != 'string') {
						log.warn('Invalid project/target type, must be a string when using the unlink-all flag');
						return false;
					}

					var lopts = { cwd: path.resolve(project), logLevel: opts.logLevel };
					_env = (0, _env3.default)(lopts);
					log.debug('Using the target directory "' + _env.cwd + '"');
					return unlinkAllLocal({ opts: lopts, env: _env, log: log });
				} else {
					var _lopts = { cwd: opts.cwd, logLevel: opts.logLevel };
					_env = (0, _env3.default)(_lopts);
					log.debug('Using the current working directory "' + _env.cwd + '"');
					if (!_env.local.isProject || _env.local.config && _env.local.config.library) {
						log.warn('The path "' + _env.cwd + '" is either not a project or is a library and cannot have links added or removed');
						return false;
					}
					return unlinkAllLocal({ opts: _lopts, env: _env, log: log });
				}
			} else {
				target = processTarget(target);
				if (project) {
					if (typeof project != 'string') {
						log.warn('Invalid project/target type, must be a string when using the unlink-all flag');
						return false;
					}
					var _lopts2 = { cwd: path.resolve(project), logLevel: opts.logLevel };
					_env = (0, _env3.default)(_lopts2);

					if (!_env.local.isProject) {
						log.warn('The path "' + _env.cwd + '" is not a project');
						return false;
					}

					log.debug('Handling normally with local links of path "' + _env.cwd + '"');
					return unlinkLocal({ opts: _lopts2, env: _env, log: log, names: target });
				} else {
					var _lopts3 = { logLevel: opts.logLevel, cwd: opts.cwd };
					_env = (0, _env3.default)(_lopts3);
					if (!_env.local.isProject) {
						log.warn('The path "' + _env.cwd + '" is not a project');
						return false;
					}
					log.debug('Handling normally with local links of path "' + _env.cwd + '"');
					return unlinkLocal({ opts: _lopts3, env: _env, log: log, names: target });
				}
			}
		}
	}

	return true;
}

function processTarget(target) {
	if (typeof target == 'string') {
		target = target.split(',');
	}
	target = target.map(function (t) {
		return t.trim();
	});
	return target;
}

function unlinkGlobal(_ref2) {
	var opts = _ref2.opts,
	    env = _ref2.env,
	    log = _ref2.log,
	    names = _ref2.names;

	var _getLinkable = (0, _link.getLinkable)({ opts: opts, env: env }),
	    linkable = _getLinkable.links,
	    failed = false;

	names.forEach(function (name) {
		var entry = linkable.find(function (l) {
			return l.name == name;
		});

		if (!entry) {
			log.debug('The library "' + name + '" is not linked and cannot be unlinked');
		} else if (!_unlink({ opts: opts, env: env, log: log, entry: entry })) {
			failed = true;
		}
	});

	return !failed;
}

function unlinkLocal(_ref3) {
	var opts = _ref3.opts,
	    env = _ref3.env,
	    log = _ref3.log,
	    names = _ref3.names;

	var _getLocal = (0, _link.getLocal)({ opts: opts, env: env }),
	    linkable = _getLocal.links,
	    failed = false;

	names.forEach(function (name) {
		var entry = linkable.find(function (l) {
			return l.name == name;
		});

		if (!entry) {
			log.debug('The library "' + name + '" is not linked and cannot be unlinked');
		} else if (!_unlink({ opts: opts, env: env, log: log, entry: entry })) {
			failed = true;
		}
	});

	return !failed;
}

function unlinkAllGlobal(_ref4) {
	var opts = _ref4.opts,
	    env = _ref4.env,
	    log = _ref4.log;

	var _getLinkable2 = (0, _link.getLinkable)({ opts: opts, env: env }),
	    linkable = _getLinkable2.links,
	    failed = false;

	log.debug('Attempting to unlink ' + linkable.length + ' global links');

	linkable.forEach(function (entry) {
		if (!_unlink({ opts: opts, env: env, log: log, entry: entry })) {
			failed = true;
		}
	});

	return !failed;
}

function unlinkAllLocal(_ref5) {
	var opts = _ref5.opts,
	    env = _ref5.env,
	    log = _ref5.log;

	var _getLocal2 = (0, _link.getLocal)({ opts: opts, env: env }),
	    linkable = _getLocal2.links,
	    failed = false;

	log.debug('Attempting to unlink ' + linkable.length + ' links from "' + env.cwd + '"');

	linkable.forEach(function (entry) {
		if (!_unlink({ opts: opts, env: env, log: log, entry: entry })) {
			failed = true;
		}
	});

	return !failed;
}

function _unlink(_ref6) {
	var opts = _ref6.opts,
	    env = _ref6.env,
	    log = _ref6.log,
	    entry = _ref6.entry;


	var err = void 0,
	    stat = void 0,
	    name = entry.name;

	stat = _utilExtra.fsync.stat(entry.linkPath);
	if (!stat) {
		log.debug('Unable to stat link path for library "' + name + '" at "' + entry.linkPath + '"');
		// not really an error, maybe that "link" thought it was linkable but not an error here
		return true;
	}

	if (!stat.isSymbolicLink()) {
		log.warn('The link path for library "' + name + '" at "' + entry.linkPath + '" is not symbolic link');
		return false;
	}

	log.debug('Attempting to unlink the library "' + name + '" at path "' + entry.linkPath + '"');
	err = _utilExtra.fsync.unlink(entry.linkPath);
	if (err) {
		log.warn('Failed to unlink the library "' + name + '" at path "' + entry.linkPath + '"');
		log.debug('Failed to unlink the library "' + name + '"', err);
		return false;
	}

	log.debug('Successfully unlinked library "' + name + '" from "' + entry.linkPath + '"');
	return true;
}