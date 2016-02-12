'use strict';


import path                       from 'path';
import colors                     from 'colors';
import {fsync,spaces}             from '../../util-extra';
import {default as logger,stdout} from '../../logger';
import {default as getEnv}        from './env';

let didSet = false, logBase;

function getLog (opts) {
	if (!didSet) {
		logBase = logger(opts).child({component: 'link'});
		logBase.level(opts.logLevel || 'warn');
		didSet = true;
	}
	return logBase;
}

function checkUser (opts) {
	let log = getLog(opts);
	if (opts.user === false) {
		log.warn('Cannot manage links in non-user mode');
		return false;
	}
	return true;
}

export default function link ({opts, env}) {
	if      (opts.listLinkable) return printLinkable({opts, env});
	else if (opts.listLocal)    return printLocal({opts, env});
	else if (opts.target)       return linkLocal({opts, env});
	else                        return makeLinkable({opts, env});
}

function printLinkable ({opts, env}) {
	let links, max;
	if (!checkUser(opts)) return false;
	({links,max} = getLinkable({opts, env}));
	print(links, 'Links', max);
}

function printLocal ({opts, env}) {
	let links, max, valid;
	if (!checkUser(opts)) return false;
	({links,max,valid} = getLocal({opts, env}));
	if (valid) print(links, 'Local Links', max);
}

function print (links, header, max) {
	stdout(`\n${header}\n`.blue);
	if (links.length === 0) stdout(`${spaces(4)}No linked libraries\n`.gray);
	else stdout(
		links.map(l => {
			return `${spaces(4)}${l.name}${spaces(max - l.name.length + 4)}${l.path}`;
		}).join('\n').gray + '\n'
	);
}

function getLinkable ({opts, env}) {
	return getLinks({opts, target: env.LINKS});
}

function getLocal ({opts, env}) {
	let   log    = getLog(opts)
		, target = (opts.target && path.resolve(opts.target)) || env.cwd
		, libDir
		, lenv
		, res;

	if (target && target != env.cwd) {
		lenv = getEnv({cwd: target}, false);
	} else lenv = env;

	if (!lenv.local.isProject) {
		log.warn(`Cannot read local links, ${target || env.cwd} is not a project`);
		return {valid: false};
	}
	
	if (lenv.local.config && lenv.local.config.library) {
		log.warn(`Cannot read local links, ${target || env.cwd} is a library`);
		return {valid: false};
	}
	
	libDir = path.join(target || lenv.cwd, lenv.getConfig('libDir'));
	
	res = getLinks({opts, target: libDir});
	res.valid = true;
	return res;
}

function getLinks ({opts, target}) {
	let   links = []
		, max   = 0
		, log   = getLog(opts);

	if (opts.user !== false) {
		let {result, error} = fsync.readDir(target);
		if (error) log.debug(`Failed to read links from path "${target}"`, error);
		else result.map(l => path.join(target, l)).filter(l => {
			let stat = fsync.stat(l);
			return stat ? stat.isSymbolicLink() : false;
		}).forEach(l => {
			// need to convert this to a full path (to link)
			// retrieve the real path of the link
			// read configurations to attempt to get the actual name of the linked project
			let   lpath         = l
				, rpath         = fsync.realpath(lpath)
				, {result: cfg} = fsync.readJson(path.join(rpath, '.enyoconfig'))
				, {result: pkg} = fsync.readJson(path.join(rpath, 'package.json'))
				, name          = (pkg && pkg.name) || (cfg && cfg.name);
			
			if (!name) {
				log.debug(`Could not retrieve a valid "name" for linked library "${lpath}" (${rpath}), skipping`);
				return;
			}
			
			if (name.length > max) max = name.length;
			links.push({name, path: rpath, linkPath: lpath, package: pkg, config: cfg});
		});
	}
	return {links,max};
}

function linkLocal ({opts, env}) {

	if (!checkUser(opts)) return false;

	let   target = opts.target
		, log    = getLog(opts)
		, libDir = path.join(env.cwd, env.getConfig('libDir'))
		, force  = !! opts.force
		, links
		, failed = false;
	
	if (!env.local.isProject) {
		log.warn(`Cannot link "${target}", "${env.cwd}" is not a project`);
		return false;
	}

	if (!target && typeof target != 'string' && !Array.isArray(target)) {
		log.warn(`Invalid target, cannot link "${target}"`);
		return false;
	}
	
	let err = fsync.ensureDir(libDir);
	if (err) {
		log.trace(`Failed to ensure libDir "${libDir}"`, err);
		log.warn(`Unable to ensure the target library directory is available "${libDir}"`);
		return false;
	}
	
	target = typeof target == 'string' ? (target.split(',').map(l => l.trim())) : target;
	
	({links} = getLinkable({opts, env}));
	target.forEach(l => {
		let entry = links.find(e => e.name == l);
		if (!entry) {
			log.warn(`Unable to find a link source for "${l}"`);
			failed = true;
			return;
		}
		// to make this link to the real path use entry.path, but the original idea is the double link
		// so it can be swapped without needing to relink all projects
		if (!makeLink({opts, from: entry.linkPath, to: path.join(libDir, entry.name), force})) {
			log.debug(`Failed to create link for "${l}"`);
			failed = true;
		}
	});
	
	return ! failed;
}

function makeLinkable ({opts, env}) {
	let   log       = getLog(opts)
		, isLibrary = env.local.isProject && (env.local.config && env.local.config.library)
		, force     = !! opts.force
		, name
		, stat
		, to;

	if (!checkUser(opts)) return false;
	if (!isLibrary) {
		log.warn('Cannot make a non-library linkable');
		return false;
	}
	
	name = (env.local.package && env.local.package.name) || (env.local.config && env.local.config.name);
	if (!name) {
		log.warn(`Cannot link library "${env.cwd}", could not determine the project name`);
		return false;
	}
	
	to   = path.join(env.LINKS, name);
	stat = fsync.stat(to);
	if (stat) {
		if (!force) {
			log.warn(`Cannot link library, a system link for a library named "${name}" already exists (${to}) and the force flag was not set`);
			return false;
		} else {
			log.warn(`Replacing existing system link for library "${name}" because the force flag was true`);
		}
	}
	
	if (!makeLink({opts, from: env.cwd, to, force})) {
		log.warn(`Failed to make "${env.cwd}" linkable`);
	}
}

function makeLink ({opts, from, to, force}) {
	let   log  = getLog(opts)
		, stat = fsync.stat(to);

	log.debug(`Attempting to make a link from "${from}" to "${to}" and the target ${stat ? 'already exists' : 'does not exist'}`);
	
	if (!stat || force) {
		if (stat) {
			log.debug(`Target path "${to}" exists and force is true, removing before linking`);
			if (!remove({opts, target: to})) return false;
		}
		let err = fsync.link(from, to);
		if (err) {
			log.debug(`Failed during linking for "${from}" to "${to}"`, err);
			return false;
		}
	} else if (stat) {
		log.debug(`Cannot create link from "${from}" to "${to}" because it already exists, use the "force" flag`);
		return false;
	}
	return true;
}

function remove ({opts, target}) {
	let   log  = getLog(opts)
		, stat = fsync.stat(target)
		, err;
	if (stat) {
		if (stat.isDirectory()) {
			log.debug(`Removal target "${target}" is a directory`);
			err = fsync.removeDir(target);
			if (err) {
				log.debug(`Failed to remove directory "${target}"`, err);
				return false;
			}
		} else if (stat.isFile()) {
			log.debug(`Removal target "${target}" is a file`);
			err = fsync.removeFile(target);
			if (err) {
				log.debug(`Failed to remove file "${target}"`, err);
				return false;
			}
		} else if (stat.isSymbolicLink()) {
			log.debug(`Removal target "${target}" is a symbolic link`);
			err = fsync.unlink(target);
			if (err) {
				log.debug(`Failed to unlink "${target}"`, err);
				return false;
			}
		}
	} else log.debug(`The requested removal target "${target}" did not exist`);
	return true;
}

export {getLinkable,getLocal,linkLocal};