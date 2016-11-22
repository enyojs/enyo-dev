'use strict';

import setup                  from './env';
import {getLinkable,getLocal} from './link';
import {fsync}                from '../../util-extra';
import {default as logger}    from '../../logger';


export default function unlink ({opts}) {

	let log = logger(opts).child({component: 'unlink'});
	log.level(opts.logLevel || 'warn');

	// unlike in other tools we really can't do much with an 'env' until we know
	// what path to explore
	if (!opts.target) {
		log.debug('No target was provided, checking current working directory to see if we are in a library');
		// in this case the only way it can be useful is if we are currently in a library
		// the global flag doesn't matter it is assumed
		let   env  = setup(opts)
			, name = (env.local.package && env.local.package.name) || (env.local.config && env.local.config.name);
		
		if (!name) {
			log.warn(`The current working directory "${env.cwd}" is a library but does not have a project name, it cannot be unlinked`);
			return false;
		}
		
		if (env.local.isProject) {
			if (env.local.config && env.local.config.library) {
				log.debug(`Current working directory "${env.cwd}" is a library`);
				return unlinkGlobal({opts, env, log, names: [name]})
			}
		}
		log.debug(`Current working directory "${env.cwd}" is not a library, it cannot be unlinked`);
		// not technically a failure
		return true;
	} else {

		let   target  = opts.target
			, project = opts.project
			, env;

		// if the global flag is set we interpret the other flags and options differently
		if (opts.global) {
			
			target = processTarget(target);
			env    = setup(opts);
			
			if (opts.unlinkAll) {
				log.debug('The global and unlink all options are set');
				return unlinkAllGlobal({opts, env, log});
			} else {
				// the project option can be ignored because it is global but we need to handle the target
				// the same as usual
				log.debug('The global option was set');
				return unlinkGlobal({opts, env, log, names: target});
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
					
					let lopts = {cwd: path.resolve(project), logLevel: opts.logLevel};
					env       = setup(lopts);
					log.debug(`Using the target directory "${env.cwd}"`);
					return unlinkAllLocal({opts: lopts, env, log});
				} else {
					let lopts = {cwd: opts.cwd, logLevel: opts.logLevel};
					env       = setup(lopts);
					log.debug(`Using the current working directory "${env.cwd}"`);
					if (!env.local.isProject || (env.local.config && env.local.config.library)) {
						log.warn(`The path "${env.cwd}" is either not a project or is a library and cannot have links added or removed`);
						return false;
					}
					return unlinkAllLocal({opts: lopts, env, log});
				}
			} else {
				target = processTarget(target);
				if (project) {
					if (typeof project != 'string') {
						log.warn('Invalid project/target type, must be a string when using the unlink-all flag');
						return false;
					}
					let lopts = {cwd: path.resolve(project), logLevel: opts.logLevel};
					env       = setup(lopts);
					
					if (!env.local.isProject) {
						log.warn(`The path "${env.cwd}" is not a project`);
						return false;
					}
					
					log.debug(`Handling normally with local links of path "${env.cwd}"`);
					return unlinkLocal({opts: lopts, env, log, names: target});
				} else {
					let lopts = {logLevel: opts.logLevel, cwd: opts.cwd};
					env       = setup(lopts);
					if (!env.local.isProject) {
						log.warn(`The path "${env.cwd}" is not a project`);
						return false;
					}
					log.debug(`Handling normally with local links of path "${env.cwd}"`);
					return unlinkLocal({opts: lopts, env, log, names: target});
				}
			}
		}
	}

	return true;
}

function processTarget (target) {
	if (typeof target == 'string') {
		target = target.split(',');
	}
	target = target.map(t => t.trim());
	return target;
}

function unlinkGlobal ({opts, env, log, names}) {

	let   {links:linkable} = getLinkable({opts, env})
		, failed           = false;

	names.forEach(name => {
		let entry = linkable.find(l => l.name == name);
		
		if (!entry) {
			log.debug(`The library "${name}" is not linked and cannot be unlinked`);
		} else if (!_unlink({opts, env, log, entry})) {
			failed = true;
		}
	});
	
	return !failed;
}

function unlinkLocal ({opts, env, log, names}) {

	let   {links:linkable} = getLocal({opts, env})
		, failed           = false;

	names.forEach(name => {
		let entry = linkable.find(l => l.name == name);
		
		if (!entry) {
			log.debug(`The library "${name}" is not linked and cannot be unlinked`);
		} else if (!_unlink({opts, env, log, entry})) {
			failed = true;
		}
	});
	
	return !failed;
}

function unlinkAllGlobal ({opts, env, log}) {

	let   {links:linkable} = getLinkable({opts, env})
		, failed           = false;

	log.debug(`Attempting to unlink ${linkable.length} global links`);

	linkable.forEach(entry => {
		if (!_unlink({opts, env, log, entry})) {
			failed = true;
		}
	});
	
	return !failed;
}

function unlinkAllLocal ({opts, env, log}) {

	let   {links:linkable} = getLocal({opts, env})
		, failed           = false;

	log.debug(`Attempting to unlink ${linkable.length} links from "${env.cwd}"`);

	linkable.forEach(entry => {
		if (!_unlink({opts, env, log, entry})) {
			failed = true;
		}
	});
	
	return !failed;
}

function _unlink ({opts, env, log, entry}) {

	let err, stat, name = entry.name;

	stat = fsync.stat(entry.linkPath);
	if (!stat) {
		log.debug(`Unable to stat link path for library "${name}" at "${entry.linkPath}"`);
		// not really an error, maybe that "link" thought it was linkable but not an error here
		return true;
	}
	
	if (!stat.isSymbolicLink()) {
		log.warn(`The link path for library "${name}" at "${entry.linkPath}" is not symbolic link`);
		return false;
	}
	
	log.debug(`Attempting to unlink the library "${name}" at path "${entry.linkPath}"`);
	err = fsync.unlink(entry.linkPath);
	if (err) {
		log.warn(`Failed to unlink the library "${name}" at path "${entry.linkPath}"`);
		log.debug(`Failed to unlink the library "${name}"`, err);
		return false;
	}
	
	log.debug(`Successfully unlinked library "${name}" from "${entry.linkPath}"`);
	return true;
}