'use strict';

var
	Promise = require('bluebird');

var
	env = require('../lib/enyo/lib/env');

env({scriptSafe: true}).then(function (opts) {
	// try to update user-defaults if the new additions have been made
	return Promise.resolve().then(function () {
		var changed = false;
		if (opts.env.user.hadConfig) {
			Object.keys(opts.env.system.config).forEach(function (key) {
				if (!opts.env.user.json.hasOwnProperty(key)) {
					changed = true;
					opts.env.user.json[key] = opts.env.system.config[key];
				}
			});
			if (changed) {
				return opts.env.user.commit();
			}
		}
	}).then(function () {
		var changed = false;
		if (opts.env.user.hadDefaults) {
			Object.keys(opts.env.system.defaults).forEach(function (key) {
				if (!opts.env.user.defaults.hasOwnProperty(key)) {
					changed = true;
					opts.env.user.defaults[key] = opts.env.system.defaults[key];
				}
			});
			if (changed) {
				return opts.env.user.commit(true);
			}
		}
	});
});