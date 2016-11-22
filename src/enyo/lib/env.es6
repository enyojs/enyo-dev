'use strict';

/*
Vastly updated over previous version, however, some changes could not be made
as desired because the change in pattern would require too much additional
time-consuming work...for now.
*/

import osenv                      from 'osenv';
import clone                      from 'clone';
import path                       from 'path';
import {fsync}                    from '../../util-extra';
import {default as logger,fatal}  from '../../logger';

// helper paths
// this may be modified in the env (mostly for testing purposes)
const HOME      = process.env.ENYO_USER_HOME || path.join(osenv.home(), '.enyo');
const CONFIG    = path.join(HOME, 'config');
const LINKS     = path.join(HOME, 'links');
const TEMPLATES = path.join(HOME, 'templates');
const DEFAULTS  = path.join(__dirname, '../defaults.json');
const DEFAULT_TEMPLATES = path.join(__dirname, './default-templates');

let defineProperty = Object.defineProperty;

// entry point for initializing an options object
// returns an environment variables hash with some accessor methods
export default function setup (opts = {}, setupEnv = true) {
	
	let log = logger(opts).child({component: 'env'});
	log.level(opts.logLevel || 'warn');
	
	let env = {
		cwd: (opts.cwd && path.resolve(opts.cwd)) || process.cwd(),
		system: getSystem({log})
	};

	env.local  = getLocalEnv({log, cwd: env.cwd});

	if (opts.user !== false) {
		
		if (setupEnv) {
			if (!setupUserEnv({log})) {
				fatal('Failed to setup environment for user, please use verbose output to see more information');
			}
		}
		
		env.HOME      = HOME;
		env.CONFIG    = CONFIG;
		env.LINKS     = LINKS;
		env.TEMPLATES = TEMPLATES;
		env.user      = getUserEnv({log})
	}
	
	defineProperty(env, 'getConfig', {value: getConfig.bind(env), enumerable: true});

	return env;
}


// --
// Setup related functions not to be exported
// --

// these will always be executed regardless of user-mode
function getSystem ({log}) {
	
	log.trace('Retrieving the system environment details');
	
	let sys = {
		defaults: fsync.readJson(DEFAULTS).result,
		templates: getSystemTemplates({log})
	};
	return sys;
}

// this only returns an object when in user mode
function getUserEnv ({log}) {
	
	log.trace('Retrieving the user environment details');
	
	let usr = {
		config: fsync.readJson(CONFIG).result || {},
		templates: getUserTemplates({log})
	};
	
	defineProperty(usr, 'setConfig', {value: updateUserConfig.bind(usr, log), enumerable: true});
	
	return usr;
}

function getLocalEnv ({log, cwd}) {

	let   packageFile   = path.join(cwd, 'package.json')
		, configFile    = path.join(cwd, '.enyoconfig')
		, {result: pkg} = fsync.readJson(packageFile)
		, {result: cfg} = fsync.readJson(configFile)
		, isProject     = !! (pkg && (pkg.name || (cfg && cfg.name)));
	
	let loc = {
		// we don't want to be able to modify non-project package.json files so we try to be
		// selective here
		config: cfg || {},
		package: isProject && pkg,
		isProject
	};
	
	// temporary fallback for lowercase outdir/outfile properties
	if (!loc.config.outFile && loc.config.outfile) loc.config.outFile = loc.config.outfile;
	if (!loc.config.outDir && loc.config.outdir) loc.config.outDir = loc.config.outdir;
	
	if (isProject && loc.config)  defineProperty(loc, 'setConfig', {value: updateLocalConfig.bind(loc, log, configFile), enumerable: true, writable: true});
	if (isProject && loc.package) defineProperty(loc, 'setPackage', {value: updateLocalPackage.bind(loc, log, packageFile), enumerable: true, writable: true});
		
	return loc;
}

// applied to env instances to retrieve the requested config property by order of preference
function getConfig (prop, ...args) {
	if (typeof prop != 'string') {
		if  (prop.hasOwnProperty(args[0])) return prop[args[0]];
		else                               return getConfig(args[0]);
	}
	if      (this.local.config && this.local.config.hasOwnProperty(prop))            return this.local.config[prop];
	else if (this.user && this.user.config && this.user.config.hasOwnProperty(prop)) return this.user.config[prop];
	else                                                                             return this.system.defaults[prop];
}

function setupUserEnv ({log}) {
	
	let err, ok = true;
	
	log.trace(`Setting up user environment "${HOME}"`);
	
	err = fsync.ensureDir(HOME);
	if (err) {
		log.debug(`Failed to ensure the user's home directory "${HOME}"`, err);
		ok = false;
	}
	
	err = fsync.ensureDir(LINKS);
	if (err) {
		log.debug(`Failed to ensure the user's links directory "${LINKS}"`, err);
		ok = false;
	}
	
	err = fsync.ensureDir(TEMPLATES);
	if (err) {
		log.debug(`Failed to ensure the user's templates directory "${TEMPLATES}"`, err);
		ok = false;
	}
	
	err = fsync.ensureJsonFile(CONFIG, {});
	if (err) {
		log.debug(`Failed to ensure the user's config file "${CONFIG}"`, err);
		ok = false;
	}
	
	return ok;
}

function updateUserConfig (log, prop, value) {
	let config = this.config;
	log.trace(`Updating the user configuration file "${CONFIG}"`);
	return update(CONFIG, config, prop, value);
}

function updateLocalConfig (log, file, prop, value) {
	let config = this.config;
	log.trace(`Updating local configuration file "${file}"`);
	return update(file, config, prop, value);
}

function updateLocalPackage (log, file, prop, value) {
	let pkg = this.package;
	log.trace(`Updating local package.json file "${file}"`);
	return update(file, pkg, prop, value);
}

function update (file, target, prop, value) {
	if (typeof prop == 'string') applyValue(target, prop, value);
	else {
		Object.keys(prop).forEach(key => {
			applyValue(target, key, prop[key]);
		});
	}
	return fsync.writeJson(file, target);
}

function applyValue (target, prop, value) {
	if (value === undefined || null) {
		delete target[prop];
	} else {
		target[prop] = value;
	}
}

// --
// Template functions
// --

function getUserTemplates ({log}) {
	return getTemplatesFromDir({log, dir: TEMPLATES});
}

function getSystemTemplates ({log}) {
	return getTemplatesFromDir({log, dir: DEFAULT_TEMPLATES});
}

function getTemplatesFromDir ({log, dir}) {
	
	log.trace(`Reading templates for directory "${dir}"`);
	
	let {result} = fsync.readDir(dir);
	return result.map(loc => {
		return getTemplate({log, template: path.join(dir, loc)});
	}).filter(template => template).reduce((map, template) => {
		if (map[template.name]) log.warn(`Duplicate template name "${template.name}" determined between "${map[template.name].path}" and "${template.path}", the last one encountered will be used`);
		map[template.name] = template;
		return map;
	}, {});
}

function getTemplate ({log, template}) {
	
	log.trace(`Fetching template details for "${template}"`);
	
	let   {result: cnf} = fsync.readJson(path.join(template, '.enyoconfig'))
		, {result: pkg} = fsync.readJson(path.join(template, 'package.json'))
		, stat          = fsync.stat(template)
		, isLink        = stat.isSymbolicLink()
		, name;
	
	if (!pkg) {
		log.warn(`Ignoring template from "${template}" because it does not have a package.json`);
		return null;
	}
	
	name = (pkg && pkg.name) || (cnf && cnf.name);
	if (!name) {
		log.warn(`Ignoring template from "${template}" because it does not have a name defined in package.json or .enyoconfig`);
		return null;
	}
	
	return {
		name,
		path: !isLink ? template : fsync.realpath(template),
		link: isLink,
		linkPath: isLink ? template : null,
		config: cnf,
		package: pkg
	};
}