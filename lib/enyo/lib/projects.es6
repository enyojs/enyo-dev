'use strict';

import Promise from 'bluebird';
import cli from '../../cli-logger';

function projects (opts) {
	if (opts.register) return register(opts);
	else if (opts.unregister) return unregister(opts);
	else return list(opts);
}

export default projects;

function register (opts) {
	// this doesn't belong here but was the only reasonable short-term solution
	return opts.env.get('scriptSafe').then(scriptSafe => {
		return scriptSafe ? Promise.resolve() : opts.env.get('name').then(name => {
			// should never happen so mostly for debugging to determine if we are somehow reaching
			// it
			if (!name) throw new Error('cannot register a project without a name');
			return opts.env.projects.set(name, opts.env.cwd, true);
		});
	});
}

function unregister (opts) {
	// this doesn't belong here but was the only reasonable short-term solution
	return opts.env.get('scriptSafe').then(scriptSafe => {
		return scriptSafe ? Promise.resolve() : opts.env.get('name').then(name => {
			// should never happen so mostly for debugging to determine if we are somehow reaching
			// it
			if (!name) throw new Error('cannot unregister a project without a name');
			return opts.env.projects.set(name, opts.env.cwd, true, null, true).then(() => {
				return opts.env.projects.get(name);
			}).then(entries => {
				if (!entries || entries.length === 0) return opts.env.projects.set(name, undefined, true, null, true);
			});
		});
	});
}

function list (opts) {
	let projects = opts.env.projects.json;
	let names = Object.keys(projects);
	if (names.length === 0) cli('no known projects');
	else {
		for (let name in projects) {
			let entries = projects[name];
			if (entries.length) for (let entry of entries) cli('%s => %s', name, entry);
		}
	}
}