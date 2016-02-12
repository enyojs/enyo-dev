'use strict';

import path                               from 'path';
import clone                              from 'clone';
import {default as Promise}               from 'bluebird';
import setup                              from './env';
import git                                from './git';
import {fsync}                            from '../../util-extra';
import {linkLocal,getLocal}               from './link';
import {default as logger,stdout}         from '../../logger';
import {getTemplates, getDefaultTemplate} from './templates';

let defineProperty = Object.defineProperty;

/*
Default command function. Handles the options as passed in from nomnom and the cli. This command must
return a resolved or rejected Promise as it is asynchronous given it may deal with dependency resolution
which is asynchronous in its nature.
*/
export default function init ({opts, env}) {

	let   project   = opts.project && path.normalize(opts.project)
		, template  = opts.template
		, isLibrary = !! opts.library
		, templates = getTemplates(env)
		, log       = logger(opts).child({component: 'init'})
		, libs;

	// set a default log level appropriate the any requested from the cli
	log.level(opts.logLevel || 'warn');

	// if (!template) template = isLibrary ? 'default-library' : getDefaultTemplate(env) || (isLibrary ? 'default-library' : 'default-app');
	if (!template) {
		let   dname = getDefaultTemplate(env)
			, dtmp  = templates[dname];
		if (!dtmp) {
			if (isLibrary) template = 'default-library';
			else           template = 'default-app';
		} else {
			if (isLibrary && (dtmp.config && !dtmp.config.library)) template = 'default-library';
			else                                                    template = dname;
		}
	}

	// attempt to ensure the requested directory
	if (!ensureProject({project, log})) return Promise.reject('Could not ensure the requested project path');

	// if the requested project is already a project, we don't need to worry about templates
	if (env.local.isProject) {
		log.debug(`The requested project "${project}" is already initialized, no need to setup a template`);
	} else {
		log.debug(`The requested project "${project}" is not initialized or is not a project, will attempt to install the template "${template}"`);
		if (!initTemplate({project, template, opts, env, log})) return Promise.reject('Failed to initialize the template');
	}

	if (opts.initLibs) {
		// we need a clean env to ensure we have the most updated information
		return initLibraries({project, template, opts, log, env: setup(opts, false)});
	}
	
	return Promise.resolve();
}

/*
Ensure the target directory exists and can be used for the project.
*/
function ensureProject ({project, log}) {

	if (!project) {
		log.warn(`No project or invalid project provided`);
		return false;
	}

	let err = fsync.ensureDir(project);
	if (err) {
		log.debug(`Unable to ensure requested project directory "${project}"`, err);
		return false;
	}
	log.debug(`Successfully ensured the requested project directory exists "${project}"`);
	return true;
}

/*
Initialize the requested template (name or location) in the project directory (already ensured).
*/
function initTemplate ({project, template, opts, env, log}) {

	log.debug(`Initializing "${project}" from the template "${template}"`);

	let   templates = getTemplates(env)
		, data      = templates[template]
		, name      = opts.name || path.basename(project)
		, stat
		, err;

	if (!data) {
		log.warn(`The requested template "${template}" does not exist`);
		return false;
	}

	data = clone(data);
	
	stat = fsync.stat(data.path);
	
	if (!stat) {
		log.debug(`The requested template "${template}" does not exist`);
		return false;
	}
	
	if      (stat.isDirectory())    err = fsync.copyDir(data.path, project);
	else if (stat.isSymbolicLink()) err = fsync.copyLinkDir(data.path, project);

	if (err) {
		log.debug(`Failed to copy template "${template}" (${data.path}) to "${project}"`, err);
		return false;
	}

	if (name != data.package.name) {
		// regardless of whether or not there was a package.json we sync this value
		log.debug(`Updating package.json "name" value to "${name}" from "${data.package.name || 'none'}"`);
		data.package.name = name;
		err = fsync.writeJson(path.join(project, 'package.json'), data.package);
		if (err) {
			log.debug({error: err}, `Failed to update the package.json for "${project}"`);
			return false;
		}
	}

	// for backward compatibility we will attempt to keep this the same as the package.json but we really
	// only want to have to deal with the name property in one of those two files
	if (data.config && data.config.hasOwnProperty('name') && data.config.name != name) {
		// we only want to update this file if it already exists
		log.debug(`Updating the .enyoconfig file "name" to "${name}" from "${data.config.name}"`);
		data.config.name = name;
		err = fsync.writeJson(path.join(project, '.enyoconfig'), data.config);
		if (err) {
			log.debug(`Failed to update the .enyoconfig for "${project}"`, err);
			return false;
		}
	}

	log.debug(`Successfully completed template initialization of "${project}" from template "${template}"`);

	return true;
}

function initLibraries ({project, template, opts, env, log}) {
	
	let   libs      = env.local.config && env.local.config.libraries
		, isLibrary = env.local.config && env.local.config.library;
	
	if (isLibrary) {
		log.debug(`Will not initialize libraries for library "${project}"`);
		return Promise.resolve();
	}
	
	if (!libs || libs.length === 0) {
		log.debug(`No libraries to initialize for "${project}"`);
		return Promise.resolve();
	}

	log.debug(`Attempting to initialize libraries for "${project}" (${libs.join(',')})`);

	return new Promise((resolve, reject) => {
		
		let   libDir    = env.getConfig('libDir')
			, sources   = env.getConfig('sources')
			, targets   = env.getConfig('targets')
			, linkAll   = !! opts.linkAllLibs
			, linkAvail = !! opts.linkAvailLibs
			, actions
			, err;
		
		if (!sources) sources = {};
		if (!targets) targets = {};
		// should never happen but COULD happen if someone deliberately entered non-string value into config
		if (!libDir)  libDir  = 'lib';
		
		err = fsync.ensureDir(path.join(project, libDir));
		if (err) {
			log.debug({error: err}, `Failed to ensure the library target directory for project "${project}" with "libDir" "${libDir}"`);
			return reject(`Failed to ensure the library target directory "${path.join(project, libDir)}"`);
		}
		
		if (linkAll) {
			log.debug('Attempting to link all libraries');
			// this method will return any libraries it did not succeed in linking
			libs = linkLibs({opts, env, libs});

			if (libs.length > 0) {
				log.debug(`Could not link ${libs.join(',')}`);
				return reject(`Failed to link the ${libs.length > 1 ? 'libraries' : 'library'} ${libs.join(', ')}`);
			} else {
				stdout('All libraries were able to be linked');
				return resolve();
			}
		} else if (linkAvail) {
			log.debug(`Attempting to link available libraries`);
			// this method will return any libraries it did not succeed in linking
			libs = linkLibs({opts, env, libs});
			if (libs.length === 0) {
				log.debug(`All libraries were linked`);
				stdout('All libraries were able to be linked');
				return resolve();
			} else {
				log.debug(`${libs.length} libraries were not linked (${libs.join(',')}) and will attempt to be resolved normally`);
			}
		}

		actions = libs.map(name => {
			
			let   dest = path.join(project, libDir, name)
				, stat = fsync.stat(dest)
				, source = sources[name]
				, target = targets[name] || 'master';
				
			if (!source) {
				log.warn(`Request to install library "${name}" but no source is available in the configuration`);
				return null;
			}
			
			// if it is already present and is a link we do nothing else
			// if it is already present and is a valid git repository carry on same
			// as if it is not present
			if (!stat || stat.isDirectory()) {
				log.debug(`Attempting to clone and/or update repository for "${name}" (${source}) at target "${target}" into "${dest}"`);
				return {name, action: git({source, target, library: name, destination: dest})};
			} else if (stat && stat.isFile()) {
				log.warn(`A file exists at the target location for library "${name}" (${dest}), please remove the file and try again`);
				return null;
			} else if (stat && stat.isSymbolicLink()) {
				log.debug(`Skipping library "${name}" because it is already present as a symbolic link`);
				return null;
			} else {
				log.debug(`Unknown conditional reached for library "${name}"`);
				return null;
			}
				
		}).filter(action => action).reduce((map, action) => {
			map[action.name] = action.action.reflect();
			return map;
		}, {});
		
		Promise.props(actions).then(result => {
			Object.keys(result).forEach(name => {
				let action = result[name];
				if (action.isRejected()) {
					log.warn(`Failed to initialize library "${name}"`);
					log.debug({reason: action.reason().message}, `Failed to initialize library "${name}"`);
				} else log.debug(`Successfully initialized library "${name}"`);
			});
			log.debug(`All libraries have been handled`);
			resolve();
		});
	});
}

function linkLibs ({opts, env, libs}) {
	let   lopts  = {target: libs, logLevel: opts.logLevel}
		, result = linkLocal({opts: lopts, env});
	if (!result) {
		let {links} = getLocal({opts, env});
		return libs.filter(l => {
			return ! links.find(t => t.name == l);
		});
	}
	return [];
}
