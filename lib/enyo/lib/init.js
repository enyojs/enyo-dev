'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = init;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _clone = require('clone');

var _clone2 = _interopRequireDefault(_clone);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _env = require('./env');

var _env2 = _interopRequireDefault(_env);

var _git = require('./git');

var _git2 = _interopRequireDefault(_git);

var _utilExtra = require('../../util-extra');

var _link = require('./link');

var _logger = require('../../logger');

var _logger2 = _interopRequireDefault(_logger);

var _templates = require('./templates');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var defineProperty = Object.defineProperty;

/*
Default command function. Handles the options as passed in from nomnom and the cli. This command must
return a resolved or rejected Promise as it is asynchronous given it may deal with dependency resolution
which is asynchronous in its nature.
*/
function init(_ref) {
	var opts = _ref.opts,
	    env = _ref.env;


	var project = opts.project && _path2.default.normalize(opts.project),
	    template = opts.template,
	    isLibrary = !!opts.library,
	    templates = (0, _templates.getTemplates)(env),
	    log = (0, _logger2.default)(opts).child({ component: 'init' }),
	    libs = void 0;

	// set a default log level appropriate the any requested from the cli
	log.level(opts.logLevel || 'warn');

	// if (!template) template = isLibrary ? 'default-library' : getDefaultTemplate(env) || (isLibrary ? 'default-library' : 'default-app');
	if (!template) {
		var dname = (0, _templates.getDefaultTemplate)(env),
		    dtmp = templates[dname];
		if (!dtmp) {
			if (isLibrary) template = 'default-library';else template = 'default-app';
		} else {
			if (isLibrary && dtmp.config && !dtmp.config.library) template = 'default-library';else template = dname;
		}
	}

	// attempt to ensure the requested directory
	if (!ensureProject({ project: project, log: log })) return _bluebird2.default.reject('Could not ensure the requested project path');

	// if the requested project is already a project, we don't need to worry about templates
	if (env.local.isProject) {
		log.debug('The requested project "' + project + '" is already initialized, no need to setup a template');
	} else {
		log.debug('The requested project "' + project + '" is not initialized or is not a project, will attempt to install the template "' + template + '"');
		if (!initTemplate({ project: project, template: template, opts: opts, env: env, log: log })) return _bluebird2.default.reject('Failed to initialize the template');
	}

	if (opts.initLibs) {
		// we need a clean env to ensure we have the most updated information
		return initLibraries({ project: project, template: template, opts: opts, log: log, env: (0, _env2.default)(opts, false) });
	}

	return _bluebird2.default.resolve();
}

/*
Ensure the target directory exists and can be used for the project.
*/
function ensureProject(_ref2) {
	var project = _ref2.project,
	    log = _ref2.log;


	if (!project) {
		log.warn('No project or invalid project provided');
		return false;
	}

	var err = _utilExtra.fsync.ensureDir(project);
	if (err) {
		log.debug('Unable to ensure requested project directory "' + project + '"', err);
		return false;
	}
	log.debug('Successfully ensured the requested project directory exists "' + project + '"');
	return true;
}

/*
Initialize the requested template (name or location) in the project directory (already ensured).
*/
function initTemplate(_ref3) {
	var project = _ref3.project,
	    template = _ref3.template,
	    opts = _ref3.opts,
	    env = _ref3.env,
	    log = _ref3.log;


	log.debug('Initializing "' + project + '" from the template "' + template + '"');

	var templates = (0, _templates.getTemplates)(env),
	    data = templates[template],
	    name = opts.name || _path2.default.basename(project),
	    stat = void 0,
	    err = void 0;

	if (!data) {
		log.warn('The requested template "' + template + '" does not exist');
		return false;
	}

	data = (0, _clone2.default)(data);

	stat = _utilExtra.fsync.stat(data.path);

	if (!stat) {
		log.debug('The requested template "' + template + '" does not exist');
		return false;
	}

	if (stat.isDirectory()) err = _utilExtra.fsync.copyDir(data.path, project);else if (stat.isSymbolicLink()) err = _utilExtra.fsync.copyLinkDir(data.path, project);

	if (err) {
		log.debug('Failed to copy template "' + template + '" (' + data.path + ') to "' + project + '"', err);
		return false;
	}

	if (name != data.package.name) {
		// regardless of whether or not there was a package.json we sync this value
		log.debug('Updating package.json "name" value to "' + name + '" from "' + (data.package.name || 'none') + '"');
		data.package.name = name;
		err = _utilExtra.fsync.writeJson(_path2.default.join(project, 'package.json'), data.package);
		if (err) {
			log.debug({ error: err }, 'Failed to update the package.json for "' + project + '"');
			return false;
		}
	}

	// for backward compatibility we will attempt to keep this the same as the package.json but we really
	// only want to have to deal with the name property in one of those two files
	if (data.config && data.config.hasOwnProperty('name') && data.config.name != name) {
		// we only want to update this file if it already exists
		log.debug('Updating the .enyoconfig file "name" to "' + name + '" from "' + data.config.name + '"');
		data.config.name = name;
		err = _utilExtra.fsync.writeJson(_path2.default.join(project, '.enyoconfig'), data.config);
		if (err) {
			log.debug('Failed to update the .enyoconfig for "' + project + '"', err);
			return false;
		}
	}

	log.debug('Successfully completed template initialization of "' + project + '" from template "' + template + '"');

	return true;
}

function initLibraries(_ref4) {
	var project = _ref4.project,
	    template = _ref4.template,
	    opts = _ref4.opts,
	    env = _ref4.env,
	    log = _ref4.log;


	var libs = env.local.config && env.local.config.libraries,
	    isLibrary = env.local.config && env.local.config.library;

	if (isLibrary) {
		log.debug('Will not initialize libraries for library "' + project + '"');
		return _bluebird2.default.resolve();
	}

	if (!libs || libs.length === 0) {
		log.debug('No libraries to initialize for "' + project + '"');
		return _bluebird2.default.resolve();
	}

	log.debug('Attempting to initialize libraries for "' + project + '" (' + libs.join(',') + ')');

	return new _bluebird2.default(function (resolve, reject) {

		var libDir = env.getConfig('libDir'),
		    sources = env.getConfig('sources'),
		    targets = env.getConfig('targets'),
		    linkAll = !!opts.linkAllLibs,
		    linkAvail = !!opts.linkAvailLibs,
		    actions = void 0,
		    err = void 0;

		if (!sources) sources = {};
		if (!targets) targets = {};
		// should never happen but COULD happen if someone deliberately entered non-string value into config
		if (!libDir) libDir = 'lib';

		err = _utilExtra.fsync.ensureDir(_path2.default.join(project, libDir));
		if (err) {
			log.debug({ error: err }, 'Failed to ensure the library target directory for project "' + project + '" with "libDir" "' + libDir + '"');
			return reject('Failed to ensure the library target directory "' + _path2.default.join(project, libDir) + '"');
		}

		if (linkAll) {
			log.debug('Attempting to link all libraries');
			// this method will return any libraries it did not succeed in linking
			libs = linkLibs({ opts: opts, env: env, libs: libs });

			if (libs.length > 0) {
				log.debug('Could not link ' + libs.join(','));
				return reject('Failed to link the ' + (libs.length > 1 ? 'libraries' : 'library') + ' ' + libs.join(', '));
			} else {
				(0, _logger.stdout)('All libraries were able to be linked');
				return resolve();
			}
		} else if (linkAvail) {
			log.debug('Attempting to link available libraries');
			// this method will return any libraries it did not succeed in linking
			libs = linkLibs({ opts: opts, env: env, libs: libs });
			if (libs.length === 0) {
				log.debug('All libraries were linked');
				(0, _logger.stdout)('All libraries were able to be linked');
				return resolve();
			} else {
				log.debug(libs.length + ' libraries were not linked (' + libs.join(',') + ') and will attempt to be resolved normally');
			}
		}

		actions = libs.map(function (name) {

			var dest = _path2.default.join(project, libDir, name),
			    stat = _utilExtra.fsync.stat(dest),
			    source = sources[name],
			    target = targets[name] || 'master';

			if (!source) {
				log.warn('Request to install library "' + name + '" but no source is available in the configuration');
				return null;
			}

			// if it is already present and is a link we do nothing else
			// if it is already present and is a valid git repository carry on same
			// as if it is not present
			if (!stat || stat.isDirectory()) {
				log.debug('Attempting to clone and/or update repository for "' + name + '" (' + source + ') at target "' + target + '" into "' + dest + '"');
				return { name: name, action: (0, _git2.default)({ source: source, target: target, library: name, destination: dest }) };
			} else if (stat && stat.isFile()) {
				log.warn('A file exists at the target location for library "' + name + '" (' + dest + '), please remove the file and try again');
				return null;
			} else if (stat && stat.isSymbolicLink()) {
				log.debug('Skipping library "' + name + '" because it is already present as a symbolic link');
				return null;
			} else {
				log.debug('Unknown conditional reached for library "' + name + '"');
				return null;
			}
		}).filter(function (action) {
			return action;
		}).reduce(function (map, action) {
			map[action.name] = action.action.reflect();
			return map;
		}, {});

		_bluebird2.default.props(actions).then(function (result) {
			Object.keys(result).forEach(function (name) {
				var action = result[name];
				if (action.isRejected()) {
					log.warn('Failed to initialize library "' + name + '"');
					log.debug({ reason: action.reason().message }, 'Failed to initialize library "' + name + '"');
				} else log.debug('Successfully initialized library "' + name + '"');
			});
			log.debug('All libraries have been handled');
			resolve();
		});
	});
}

function linkLibs(_ref5) {
	var opts = _ref5.opts,
	    env = _ref5.env,
	    libs = _ref5.libs;

	var lopts = { target: libs, logLevel: opts.logLevel },
	    result = (0, _link.linkLocal)({ opts: lopts, env: env });
	if (!result) {
		var _ret = function () {
			var _getLocal = (0, _link.getLocal)({ opts: opts, env: env }),
			    links = _getLocal.links;

			return {
				v: libs.filter(function (l) {
					return !links.find(function (t) {
						return t.name == l;
					});
				})
			};
		}();

		if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
	}
	return [];
}