'use strict';

import colors from 'colors';
import logger from '../../logger';
import cli    from '../../cli-logger';

const log = logger.child({command: 'templates'});

/*
Manage templates.
*/
export default function templates (opts) {

	// this command cannot be run in scriptSafe mode
	if (opts.scriptSafe) {
		log.warn('Command "templates" cannot be run in script-safe mode');
		return false;
	}

	if      (opts.action == 'add')     return add(opts);
	else if (opts.action == 'remove')  return remove(opts);
	else if (opts.action == 'list')    return list(opts);
	else if (opts.action == 'install') return install(opts);
	else if (opts.action == 'default') return setDefault(opts);
	else {
		log.warn('Command "templates" must have an action and it must be one of "add", "remove", "list", "install" or "default"');
		return false;
	}
}






function add (opts) {

	log.level(opts.logLevel || 'warn');
	log.debug(`Attempting to add template "${opts.target}"`)

}

function remove (opts) {

	log.level(opts.logLevel || 'warn');


}

function install (opts) {

	log.level(opts.logLevel || 'warn');


}

function list (opts) {

	log.level(opts.logLevel || 'warn');


}

function setDefault (opts) {

	log.level(opts.logLevel || 'warn');

	if (opts.scriptSafe) {
		log.debug({function: 'setDefault'}, `Function cannot be run in script safe mode`);
		return Promise.reject(`Function "setDefault()" cannot be run in script safe mode`);
	}

	let   target    = opts.target
		, templates = getTemplates(opts)
		, curr      = getDefaultTemplate(opts) || '';

	if      (!target) log.debug(`Removing the default template configuration value`);
	else if (!templates[target]) {
		log.warn(`Cannot set the default template, "${target}" is not a known template`);
		return Promise.resolve();
	}
	else if (curr && curr == target) {
		log.debug(`No update necessary, the default is already "${curr}" (${target})`);
		return Promise.resolve();
	}
	else log.debug(`Attempting to set the default template to "${target}" from "${curr}"`);

	return config({target: 'defaultTemplate', value: target, global: true, array: false}).then(() => {
		log.debug(`Successfully set the default template to "${target}" from "${curr}"`);
	}, (e) => {
		log.debug({error: e}, `Failed to set the default template value to "${target}" from "${curr}"`);
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
	return opts.env.system.config.defaultTemplate;
}

export {add,remove,install,list,setDefault,getTemplates,getDefaultTemplate};