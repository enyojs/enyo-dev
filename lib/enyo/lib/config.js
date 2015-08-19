'use strict';

var
	Promise = require('bluebird');

var
	cli = require('../../cli-logger');

var exports = module.exports = Promise.method(function (opts) {
	if (opts.set) return set(opts);
	else if (opts.get) return get(opts);
	else if (opts.remove) return remove(opts);
	else if (opts.reset) return reset(opts);
	else if (opts.value === undefined) return get(opts);
	else return set(opts);
});

function get (opts) {
	return opts.env.get(opts.target, opts.global).then(function (value) {
		cli(value);
		return value;
	});
}

function set (opts) {
	return opts.env.set(opts.target, opts.value, opts.global, opts.array);
}

function remove (opts) {
	return opts.env.remove(opts.target, opts.value, opts.global, opts.array);
}

function reset (opts) {
	return opts.env.reset(opts.target, opts.global);
}