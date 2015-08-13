'use strict';

var
	util = require('util'),
	path = require('path');

var
	Transform = require('stream').Transform,
	Promise = require('bluebird');

var
	findIndex = require('find-index');

var
	logger = require('../../../logger'),
	utils = require('../../../utils'),
	hasher = require('../hasher');

var
	log = logger.child({component: 'factor-source-stream'});

module.exports = FactorSourceStream;

function FactorSourceStream (opts) {
	if (!(this instanceof FactorSourceStream)) return new FactorSourceStream(opts);
	Transform.call(this, {objectMode: true});
	opts = opts || {};
	this.options = opts;
	this.modules = [];
	this.bundles = {};
	this.graph = {};
	this.store = {};
	this.requests = false;
	this.library = opts.library;
	log.level(opts.logLevel);
}

util.inherits(FactorSourceStream, Transform);

var proto = FactorSourceStream.prototype;

proto._transform = function (entry, nil, next) {
	this.load(entry).then(next);
};

proto._flush = function (done) {
	this.factor().then(done);
};

proto.load = Promise.method(function (entry) {
	if (entry.request) this.requests = true;
	this.modules.push(entry);
	this.store[entry.name] = entry;
});

proto.factor = Promise.method(function () {
	if (log.info()) log.info('factoring %d modules into bundles', this.modules.length);
	return this.requests ? this.factorWithRequests() : this.factorBasic();
});

proto.factorBasic = function () {
	var stream, modules;
	if (log.info()) log.info('using basic factorization');
	stream = this;
	modules = this.modules;
	modules.forEach(function (entry) {
		stream.bundle(entry);
	});
	this.postprocess();
};

proto.postprocess = function () {
	var bundles, stream, opts;
	stream = this;
	opts = this.options;
	bundles = this.bundles;
	Object.keys(bundles).forEach(function (name) {
		var bundle = bundles[name];
		if (opts.skip && opts.skip.indexOf(name) > -1) bundle.ignore = true;
		else if (!opts.externals && bundle.external) bundle.ignore = true;
		if (log.info()) log.info({bundle: name}, 'setting bundle %s to %s ignored', name, bundle.ignore ? 'be' : 'not be');
		stream.push(bundle);
	});
	if (log.info()) log.info('factorization of %d modules and %d bundles complete', this.modules.length, Object.keys(bundles).length);
	this.push(null);
};

proto.bundle = function (entry) {
	var stream, bundle, opts;
	stream = this;
	opts = this.options;
	bundle = this.getBundleFor(entry);
	bundle.order.push(entry.name);
	bundle.modules[entry.name] = entry;
	if (entry.entry) bundle.entry = true;
	if (entry.dependencies && entry.dependencies.length) {
		entry.dependencies.forEach(function (dep) {
			var bn = stream.getBundleNameFor(dep.name);
			if (bn != bundle.name) {
				if (bundle.dependencies.indexOf(bn) === -1) {
					if (log.debug()) {
						log.debug({module: entry.relName, bundle: bundle.name}, 'adding bundle %s as a dependency because of module %s', bn, stream.getModuleFromName(dep.name).relName);
					}
					bundle.dependencies.push(bn);
				}
			}
		});
	}
	if (entry.dependents && entry.dependents.length) {
		entry.dependents.forEach(function (depName) {
			var bn = stream.getBundleNameFor(depName);
			if (bn != bundle.name && bundle.dependents.indexOf(bn) === -1) {
				bundle.dependents.push(bn);
			}
		});
	}
	if (entry.external) bundle.external = true;
	// this is really only for the list-only scenario for context
	if (!bundle.fullpath) {
		bundle.fullpath = entry.lib || opts.package;
	}
};

proto.getBundleFor = function (entry) {
	var name, bundles, bundle;
	bundles = this.bundles;
	name = this.getBundleNameFor(entry);
	bundle = bundles[name] || this.makeBundleFor(name);
	return bundle;
};

proto.makeBundleFor = function (name) {
	var bundles, bundle, opts;
	opts = this.options;
	bundles = this.bundles;
	bundle = bundles[name];
	if (bundle) return bundle;
	bundle = bundles[name] = {
		name: name,
		modules: {},
		order: [],
		dependencies: [],
		dependents: [],
		entry: false,
		external: false,
		isBundle: true,
		fullpath: '',
		ignore: false
	};
	return bundle;
};

proto.getBundleNameFor = function (entry) {
	var name, bn, opts;
	opts = this.options;
	if (typeof entry == 'string') {
		name = entry;
		entry = this.getModuleFromName(name);
	}
	if (entry.bundleName) return entry.bundleName;
	else if (entry.libName) bn = entry.libName;
	else bn = path.basename(opts.package);
	entry.bundleName = bn;
	if (log.debug()) log.debug({module: entry.relName, bundle: bn}, 'setting bundle name for %s to %s', entry.relName, bn);
	return bn;
};

proto.getModuleFromName = function (name) {
	return this.store[name];
};