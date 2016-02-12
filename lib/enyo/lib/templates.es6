'use strict';

import colors                              from 'colors';
import path                                from 'path';
import {default as logger,stdout}          from '../../logger';
import {fsync,spaces,isGitUri,parseGitUri} from '../../util-extra';
import crypto                              from 'crypto';
import git                                 from './git';
import {default as setup}                  from './env';

let didSet = false, logBase;

function getLog (opts) {
	if (!didSet) {
		logBase = logger(opts).child({component: 'templates'});
		logBase.level(opts.logLevel || 'warn');
		didSet = true;
	}
	return logBase;
}

function checkUser (opts) {
	let log = getLog(opts);
	if (opts.user === false) {
		log.warn('Cannot complete template related request in non-user mode');
		return false;
	}
	return true;
}

/*
Manage templates. Returns a promise.
*/
export default function templates ({opts, env}) {

	let log = getLog(opts);

	if      (opts.action == 'add')     return add({opts, env, log});
	else if (opts.action == 'remove')  return remove({opts, env, log});
	else if (opts.action == 'list')    return list({opts, env, log});
	else if (opts.action == 'install') return install({opts, env, log});
	else if (opts.action == 'default') return setDefault({opts, env, log});
	else {
		log.warn(`Cannot complete${opts.action ? (' unknown action "' + opts.action + '"') : ' no action provided'}`);
		return false;
	}
}

function add ({opts, env, log}) {

	log.debug(`Attempting to add template from "${opts.target || env.cwd}"`);
	
	if (!checkUser(opts)) return false;
	
	if (!opts.target) log.debug(`Using the current working directory as the target to add since no "target" was provided (${env.cwd})`);
	
	let   target    = path.resolve(opts.target || env.cwd)
		, templates = getTemplates(env);

	if (fsync.exists(target)) {
		let   {result: config} = fsync.readJson(path.join(target, '.enyoconfig'))
			, {result: pkg}    = fsync.readJson(path.join(target, 'package.json'))
			, name             = (pkg && pkg.name) || (config && config.name) || path.basename(target);
	
		log.debug(`Determined template "${target}" does exist and the name of the template is "${name}"`);
		if (!pkg || !config) {
			log.warn(`Target template "${name}" (${target}) does not have both a package.json and .enyoconfig file as required`);
			return false;
		}
	
		if (templates[name]) {
			log.warn(`A template by the name "${name}" is already registered on the system and cannot be added again`);
			return false;
		} else {
			let   dest = path.join(env.TEMPLATES, tmp())
				, err  = fsync.link(target, dest);
			if (!err) {
				log.debug(`Successfully linked the requested template from "${target}" to "${dest}"`);
				return true;
			} else {
				log.debug(`Failed to copy the requested template location from "${target}" to "${dest}"`, err);
				log.warn(`Failed to add the template "${name}" (${target})`);
				return false;
			}
		}
	} else {
		log.warn(`The requested template "${target}" does not exist and cannot be added`);
		return false;
	}
}

function remove ({opts, env, log}) {

	log.debug(`Attempting to remove template "${opts.target}"`);
	
	if (!checkUser(opts)) return false;
	if (!opts.target) {
		log.warn(`Cannot remove a template without a "target"`);
		return false;
	}
	
	let   target     = opts.target
		, templates  = getTemplates(env)
		, entry      = templates[target]
		, defaultTpl = getDefaultTemplate(env)
		, stat       = entry && fsync.stat(entry.path)
		, err;

	if (!entry) log.warn(`Cannot remove unknown template "${target}"`);
	else {
		if (stat) {
			if (stat.isDirectory()) err = fsync.removeDir(entry.path);
			else                    err = fsync.unlink(entry.path);
		
			if (err) {
				log.debug(`Failed to remove the requested template "${target}"`, err);
				log.warn(`Failed to remove the requested template "${target}"`);
				return false;
			}

			log.debug(`Successfully removed the requested template "${target}"`);
		} else log.debug(`Nothing to do, the path did not exist for "${target}" (${entry.path})`);
	}
	
	if (defaultTpl && defaultTpl == target) {
		log.debug(`Removing the default template value since it was set to the currently removed template "${target}"`);
		opts.target = '';
		return setDefault({opts, log, env});
	}
	
	return true;
}

function tmp () {
	let h = crypto.createHash('sha256');
	h.update(Math.random().toString());
	return h.digest('hex').slice(0,16);
}

function install ({opts, env, log}) {

	if (!checkUser(opts)) return false;

	let   target    = opts.target
		, action    = opts.action
		, isuri     = isGitUri(target)
		, parts     = isuri ? parseGitUri(target) : null
		, templates = getTemplates(env)
		, dest;

	log.debug(parts, `Attempting to install a template from a git uri "${target}"`);

	if (!isuri) {
		log.warn(`The requested install target "${target}" is not a valid URI`);
		return false;
	}
	
	dest = path.join(env.TEMPLATES, tmp());
	
	return git({source: parts.uri, target: parts.target, destination: dest, library: parts.name}).then(() => {
		// check to see if it is valid
		let   lenv = setup({cwd: dest, user: false}, false)
			, name = (lenv.local.package && lenv.local.package.name) || (lenv.local.config && lenv.local.config.name);
		if (!lenv.local.isProject || !name) {
			log.warn(`The requested uri "${parts.uri}" is not a valid template, cleaning up`);
			let err = fsync.removeDir(dest);
			if (err) {
				log.debug(`Failed to removed directory "${dest}" after failed attempt to install template, will need to remove manually`, err);
				log.warn(`Could not cleanup after installation of bad template, will need to cleanup manually "${dest}"`);
			} else log.debug(`Cleanup complete "${dest}"`);
			return false;
		} else {
			if (templates[name]) {
				log.warn(`There is already a template installed by the name "${name}", you will need remove one of them`);
			} else log.debug(`Successfully installed the git repository as a template "${name}"`);
		}
	}).catch(e => {
		log.debug(`Failed to install the requested uri "${parts.uri}"`, e);
		log.warn(`Failed to install the requested uri "${parts.uri}"`);
	});
}

function list ({opts, env, log}) {

	// this is the lone operation that does not require no-script-safe
	let {list: res, max} = getTemplatesList(env);
	
	log.debug(`Listing ${res.length} known templates`);

	stdout('\nTemplates\n'.blue);
	stdout(res.map(t => {
		return `${spaces(4)}${t.name + (t.default ? '*' : '')}${spaces(max - t.name.length + 4 - (t.default ? 1 : 0))}${t.user ? 'local ' : 'system'}${spaces(4)}${t.data.library ? 'library' : 'app'}`;
	}).join('\n').gray + '\n');
	return true;
}

function setDefault ({opts, env, log}) {

	if (!checkUser(opts)) return false;

	let   target    = opts.target || ''
		, templates = getTemplates(env)
		, curr      = getDefaultTemplate(env) || '';

	if      (!target) log.debug(`Removing the default template configuration value`);
	else if (!templates[target]) {
		// log.warn(`Cannot set the default template, "${target}" is not a known template`);
		log.warn(`Could not set the default template value to "${target}" because it is not a known template`);
		return false;
	}
	else if (curr && curr == target) {
		log.debug(`No update necessary, the default is already "${curr}" (${target})`);
		return true;
	}
	else log.debug(`Attempting to set the default template to "${target}" from "${curr}"`);

	let err = env.user.setConfig('defaultTemplate', target);
	if (err) {
		log.debug(`Failed to set the default template to "${target}" from "${curr}"`, err);
		log.warn(`Could not update the default template`);
		return false;
	}
	log.debug(`Successfully set the default template to "${target}" from "${curr}"`);
	return true;
}

function getTemplates (env) {

	let   ret = {}
		, usr = env.user.templates
		, sys = env.system.templates;

	if (usr) Object.keys(usr).forEach(name => ret[name] = usr[name]);
	Object.keys(sys).forEach(name => ret[name] = sys[name]);

	return ret;
}

function getDefaultTemplate (env) {
	// this may return falsy which is ok and expected
	return env.user && env.user.config && env.user.config.defaultTemplate;
}

function getTemplatesList (env) {
	let   list = []
		, len  = 0
		, dtpl = getDefaultTemplate(env) || '';

	if (env.user && env.user.templates) {
		Object.keys(env.user.templates).forEach(t => {
			if (t.length > len) len = t.length;
			list.push({
				name: t,
				path: env.user.templates[t].path,
				user: true,
				data: env.user.templates[t].config,
				default: dtpl && dtpl == t
			});
		});
	}
	// now process whatever system defaults we've added
	Object.keys(env.system.templates).forEach(t => {
		if (t.length > len) len = t.length;
		list.push({
			name: t,
			path: env.system.templates[t].path,
			system: true,
			data: env.system.templates[t].config,
			default: dtpl && dtpl == t
		});
	});
	
	return {list, max: len};
}

export {getTemplates,getDefaultTemplate};