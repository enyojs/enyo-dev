'use strict';



import fs                   from 'fs-extra';
import path                 from 'path';
import clone                from 'clone';
import {default as Promise} from 'bluebird';
import cli                  from '../../cli-logger';
import logger               from '../../logger';
import {getLinkable}        from './link';
import link                 from './link';
import git                  from './git';
import {getTemplates, getDefaultTemplate} from './templates';


const log = logger.child({command: 'init'});

/*
Default command function. Handles the options as passed in from nomnom and the cli. This command must
return a resolved or rejected Promise as it is asynchronous given it may deal with dependency resolution
which is asynchronous in its nature.
*/
export default function init (opts) {

	let   project   = opts.project && path.normalize(opts.project)
		, template  = opts.template
		, isLibrary = !! opts.library
		, data;

	// set a default log level appropriate the any requested from the cli
	log.level(opts.logLevel || 'warn');

	if (!template) template = getDefaultTemplate(opts) || (isLibrary ? 'default-library' : 'default-app');

	// attempt to ensure the requested directory
	if (!ensureProject(project)) return Promise.reject('Could not ensure the requested project path');

	// if the requested project is already a project, we don't need to worry about templates
	if (opts.env.hasConfig() || opts.env.hasPackage()) {
		log.debug(`The requested project "${project}" is already initialized, no need to setup a template`);
	} else {
		log.debug(`The requested project "${project}" is not initialized or is not a project, will attempt to install the template "${template}"`);
		if (!initTemplate(project, template, opts)) return Promise.reject('Failed to initialize the template');
	}

	if (opts.initLibs) {
		data = getTemplates(opts)[template];
		if (data.config.libraries && data.config.libraries.length) {
			return initLibraries(project, template, data, opts);
		}
	}
	
	return Promise.resolve();
}

/*
Ensure the target directory exists and can be used for the project.
*/
function ensureProject (project) {

	if (!project) {
		log.warn(`No project or invalid project provided`);
		return false;
	}

	try {
		fs.ensureDirSync(project);
		log.trace(`Successfully ensured the requested project directory "${project}"`);
	} catch (e) {
		log.debug({error: e}, `Unable to ensure requested project directory "${project}"`);
		return false;
	}

	return true;
}

/*
Initialize the requested template (name or location) in the project directory (already ensured).
*/
function initTemplate (project, template, opts) {

	log.debug(`Initializing "${project}" from the template "${template}"`);

	let   templates = getTemplates(opts)
		, data      = templates[template]
		, name      = opts.name || path.basename(project)
		, err;

	if (!data) {
		log.warn(`The requested template "${template}" does not exist`);
		return false;
	}

	data = clone(data);

	err = copy(data.path, project);
	if (err) {
		log.debug({error: err}, `Failed to copy template "${template}" (${data.path}) to "${project}"`);
		return false;
	}

	if (name != data.package.name) {
		// regardless of whether or not there was a package.json we sync this value
		log.debug(`Updating package.json "name" value to "${name}" from "${data.package.name || 'none'}"`);
		data.package.name = name;
		err = writeJson(path.join(project, 'package.json'), data.package);
		if (err) {
			log.debug({error: err}, `Failed to update the package.json for "${project}"`);
			return false;
		}
	}

	if (Object.keys(data.config).length && data.config.name != name) {
		// we only want to update this file if it already exists
		log.debug(`Updating the .enyoconfig file "name" to "${name}" from "${data.config.name}"`);
		data.config.name = name;
		err = writeJson(path.join(project, '.enyoconfig'), data.config);
		if (err) {
			log.debug({error: err}, `Failed to update the .enyoconfig for "${project}"`);
			return false;
		}
	}

	// we need to update the env...
	opts.env.config.json  = clone(data.config);
	opts.env.package.json = clone(data.package);

	log.debug(`Successfully completed template initialization of "${project}" from template "${template}"`);

	return true;
}

function copy (from, to) {
	try {
		fs.copySync(from, to);
	} catch (e) {
		return e;
	}
}

function writeJson (file, data) {
	try {
		fs.writeJsonSync(file, data, {spaces: 2});
	} catch (e) {
		return e;
	}
}

function ensureDir (target) {
	try {
		fs.ensureDirSync(target);
	} catch (e) {
		return e;
	}
}

function getLocalStat (target) {
	try {
		return fs.lstatSync(target);
	} catch (e) {};
}

function initLibraries (project, template, data, opts) {

	log.debug(`Attempting to initialize libraries for "${project}" (${data.config.libraries.join(',')})`);

	return new Promise((resolve, reject) => {
		Promise.join(
			getLinkableMap(opts),
			opts.env.get('libDir'),
			opts.env.get('sources'),
			opts.env.get('targets'),
			function (linkable, libDir, sources, targets) {

			let   linkAll   = opts.linkAllLibs
				, linkAvail = opts.linkAvailLibs
				, actions
				, err;
			
			if (!sources) sources = {};
			if (!targets) targets = {};
			if (!libDir)  libDir  = opts.env.system.defaults.libDir;

			err = ensureDir(path.join(project, libDir));
			if (err) {
				log.debug({error: err}, `Failed to ensure the library target directory for project "${project}" with "libDir" "${libDir}"`);
				return reject(`Failed to ensure the library target directory "${path.join(project, libDir)}"`);
			}

			actions = data.config.libraries.map(name => {
				
				let   dest = path.join(project, libDir, name)
					, stat = getLocalStat(dest);
				if (linkAll) {
					if (!linkable[name]) {
						log.warn(`Request to link all libraries but "${name}" is not available to be linked`);
						return null;
					} else if (stat && (stat.isSymbolicLink() || stat.isDirectory() || stat.isFile())) {
						// debugging because no doubt this would happen and Roy would claim it wasn't working as intended...
						log.debug(`The library "${name}" could not be linked even though it is available because the library already exists`);
						if (stat.isSymbolicLink()) cli(`${name} is already a symbolic link, skipping`);
						else cli(`skipping ${name} because it already exists as a ${stat.isDirectory() ? 'directory' : 'file'}`);
						return null;
					}
					log.debug(`Attempting to link library "${name}"`);
					return {name, action: link({target: name, env: opts.env})};
				} else if (linkAvail && linkable[name] && !stat) {
					log.debug(`Attempting to link library "${name}"`);
					return {name, action: link({target: name, env: opts.env})};
				} else {
					
					let   source = sources[name]
						, target = targets[name] || 'master';
					
					if (!source) {
						log.warn(`Request to install library "${name}" but no source is available in the configuration`);
						return null;
					}
					
					if (linkAvail && linkable[name]) {
						// debugging because no doubt this would happen and Roy would claim it wasn't working as intended...
						log.debug(`The library "${name}" could not be linked even though it is available because the library already exists`);
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
	});
}

function getLinkableMap (opts) {
	return getLinkable(opts).then(linkable => {
		return linkable.reduce((map, entry) => {
			map[entry.name] = entry.path;
			return map;
		}, {});
	});
}