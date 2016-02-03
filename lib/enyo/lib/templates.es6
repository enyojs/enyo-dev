'use strict';

import colors                     from 'colors';
import path                       from 'path';
import {default as logger,stdout} from '../../logger';
import {default as Promise}       from 'bluebird';
import {fsync,spaces}             from '../../util-extra';
import config                     from './config';
import crypto                     from 'crypto';

const log = logger.child({command: 'templates'});

/*
Manage templates. Returns a promise.
*/
export default function templates (opts) {

	// this command cannot be run in scriptSafe mode
	if (opts.scriptSafe) return noScriptSafe();
	log.level(opts.logLevel || 'warn');

	if      (opts.action == 'add')     return add(opts);
	else if (opts.action == 'remove')  return remove(opts);
	else if (opts.action == 'list')    return list(opts);
	else if (opts.action == 'install') return install(opts);
	else if (opts.action == 'default') return setDefault(opts);
	else {
		log.debug('Command executed with no or unknown "action" value');
		return Promise.reject('Command "templates" must have an action and it must be one of "add", "remove", "list", "install" or "default"');
	}
}


function noScriptSafe () {
	log.debug('Attempt to execute command in script-safe mode');
	return Promise.reject('Commands related to templates cannot be executed in script-safe mode');
}



function add (opts) {

	log.level(opts.logLevel || 'warn');
	log.debug(`Attempting to add template from "${opts.target || opts.env.cwd}"`);
	
	if (opts.scriptSafe) return noScriptSafe();
	if (!opts.target)    log.debug(`Using the current working directory as the target to add since no "target" was provided (${opts.env.cwd})`);
	
	
	let   target    = path.resolve(opts.target || opts.env.cwd)
		, templates = getTemplates(opts);

	return new Promise((resolve, reject) => {

		if (fsync.exists(target)) {
			let   {result: config} = fsync.readJson(path.join(target, '.enyoconfig'))
				, {result: pkg}    = fsync.readJson(path.join(target, 'package.json'))
				, name             = (pkg && pkg.name) || (config && config.name) || path.basename(target);
		
			log.debug(`Determined template "${target}" does exist and the name of the template is "${name}"`);
		
			if (templates[name]) {
				reject(`A template by the name "${name}" is already registered on the system and cannot be added again`);
			} else {
				let   dest = path.join(opts.env.userTemplates, tmp())
					, err  = fsync.link(target, dest);
				if (!err) {
					log.debug(`Successfully linked the requested template from "${target}" to "${dest}"`);
					resolve();
				} else {
					log.debug({error: err.toString()}, `Failed to copy the requested template location from "${target}" to "${dest}"`);
					reject(`Failed to add the template "${name}" (${target})`);
				}
			}
		} else reject(`The requested template "${target}" does not exist and cannot be added`)

	});
}

function remove (opts) {

	log.level(opts.logLevel || 'warn');
	log.debug(`Attempting to remove template "${opts.target}"`);
	
	if (opts.scriptSafe) return noScriptSafe();
	if (!opts.target)    return Promise.reject(`Cannot remove a template without a "target"`);
	
	let   target     = opts.target
		, templates  = getTemplates(opts)
		, entry      = templates[target]
		, defaultTpl = getDefaultTemplate(opts)
		, stat       = entry && fsync.stat(entry.path)
		, err;

	if (!entry) log.warn(`Cannot remove unknown template "${target}"`);
	else {
		if (stat) {
			if (stat.isDirectory()) err = fsync.removeDir(entry.path);
			else                    err = fsync.unlink(entry.path);
		
			if (err) {
				log.debug({error: err.toString()}, `Failed to remove the requested template "${target}"`);
				return Promise.reject(`Failed to remove the requested template "${target}"`);
			}

			log.debug(`Successfully removed the requested template "${target}"`);
		} else log.debug(`Nothing to do, the path did not exist for "${target}" (${entry.path})`);
	}
	
	if (defaultTpl && defaultTpl == target) {
		log.debug(`Removing the default template value since it was set to the currently removed template "${target}"`);
		return setDefault({env: opts.env, target: ''});
	}
	
	return Promise.resolve();
}

function tmp () {
	let h = crypto.createHash('sha256');
	h.update(Math.random().toString());
	return h.digest('hex').slice(0,16);
}

function install (opts) {



}

function list (opts) {

	log.level(opts.logLevel || 'warn');
	// this is the lone operation that does not require no-script-safe
	let {list: res, max} = getTemplatesList(opts);
	
	log.debug(`Listing ${res.length} known templates`);

	stdout('\nTemplates\n'.blue);
	stdout(res.map(t => {
		return `${spaces(4)}${t.name + (t.default ? '*' : '')}${spaces(max - t.name.length + 4 - (t.default ? 1 : 0))}${t.user ? 'local ' : 'system'}${spaces(4)}${t.data.library ? 'library' : 'app'}`;
	}).join('\n').gray + '\n');
	return Promise.resolve();
}

function setDefault (opts) {

	log.level(opts.logLevel || 'warn');
	if (opts.scriptSafe) return noScriptSafe();

	let   target    = opts.target || ''
		, templates = getTemplates(opts)
		, curr      = getDefaultTemplate(opts) || '';

	if      (!target) log.debug(`Removing the default template configuration value`);
	else if (!templates[target]) {
		// log.warn(`Cannot set the default template, "${target}" is not a known template`);
		return Promise.reject(`Could not set the default template value to "${target}" because it is not a known template`);
	}
	else if (curr && curr == target) {
		log.debug(`No update necessary, the default is already "${curr}" (${target})`);
		return Promise.resolve();
	}
	else log.debug(`Attempting to set the default template to "${target}" from "${curr}"`);

	return config({target: 'defaultTemplate', value: target, global: true, array: false, env: opts.env}).then(() => {
		log.debug(`Successfully set the default template to "${target}" from "${curr}"`);
	}, (e) => {
		log.debug(e, `Failed to set the default template value to "${target}" from "${curr}"`);
		return Promise.reject(`Could not update the default template value to "${target}"`);
	});
}

function getTemplates (opts) {

	let   ret = {}
		, usr = opts.env.user.templates
		, sys = opts.env.system.templates;

	if (usr) Object.keys(usr).forEach(name => ret[name] = usr[name]);
	Object.keys(sys).forEach(name => ret[name] = sys[name]);

	return ret;
}

function getDefaultTemplate (opts) {
	// this may return falsy which is ok and expected
	return opts.env.user && opts.env.user.json && opts.env.user.json.defaultTemplate;
}

function getTemplatesList (opts) {
	let   list = []
		, len  = 0
		, dtpl = getDefaultTemplate(opts) || ''
		, env  = opts.env;

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

export {add,remove,install,list,setDefault,getTemplates,getDefaultTemplate};