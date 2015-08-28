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
	utils = require('../../../utils');

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
	this.load(entry);
	next();
};

proto._flush = function (done) {
	this.factor();
	done();
};

proto.load = function (entry) {
	if (entry.request) this.requests = true;
	this.modules.push(entry);
	this.store[entry.name] = entry;
};

proto.factor = function () {
	if (log.info()) log.info('factoring %d modules into bundles', this.modules.length);
	return this.requests ? this.factorWithRequests() : this.factorBasic();
};

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
		if (stream.requests) stream.checkDependencies(bundle);
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
	if (entry.trace) {
		if (log.debug()) {
			log.debug({bundle: bundle.name, module: entry.relName}, 'setting bundle.request to %s from %s', !! entry.trace.requested, !! bundle.request);
			log.debug({bundle: bundle.name, module: entry.relName}, 'setting bundle.includeRequest to %s from %s', !! entry.requests.length, bundle.includeRequest);
		}
		if (entry.trace.requested) bundle.request = entry.trace.requested;
		if (entry.requests.length) bundle.includeRequest = !! entry.requests.length;
	}
	// this is really only for the list-only scenario for context
	if (!bundle.fullpath) {
		bundle.fullpath = entry.lib || opts.package;
	}
};

proto.checkDependencies = function (bundle) {
	var i, dep;
	for (i = bundle.dependencies.length - 1; i >= 0; --i) {
		dep = this.getBundleFromName(bundle.dependencies[i]);
		if (bundle.request && !dep.request) {
			// this is a case where a module in the dependency-bundle is actually required by the
			// requested bundle but the module it needs will already be present so in this case it
			// won't actually be a dependency
			bundle.dependencies.splice(i, 1);
		}
	}
	for (i = bundle.dependents.length - 1; i >= 0; --i) {
		dep = this.getBundleFromName(bundle.dependents[i]);
		if (!bundle.request && dep.request) {
			// reverse of the above
			bundle.dependents.splice(i, 1);
		}
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
		ignore: false,
		request: false
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

proto.getBundleFromName = function (name) {
	return this.bundles[name];
};

proto.factorWithRequests = function () {
	var stream, modules;
	if (log.info()) log.info('using request factorization');
	stream = this;
	modules = this.modules;
	// in this scheme we do a two-pass system to analyze the entire graph then we can move forward
	// with the correct relationships
	this.analyze();
	modules.reverse().forEach(function (entry) {
		stream.bundle(entry);
	});
	this.postprocess();
};

proto.analyze = function () {
	var stream, modules, db;
	stream = this;
	modules = this.modules;
	db = log.debug();
	modules.reverse().forEach(function (entry) {
		if (db) log.debug({module: entry.relName}, 'analyzing module');
		if (entry.entry) {
			entry.trace = {required: true, requires: [], requests: []};
			entry.bundleName = stream.getBundleNameFor(entry);
			if (db) log.debug({module: entry.relName, bundle: entry.bundleName}, 'module is an entry point and will be handled normally');
			return;
		} else stream.trace(entry);
	});
};

proto.trace = function (entry) {
	var db, stream, requests, requested, requires, required, o_required, o_requested, opts, trace;
	stream = this;
	opts = this.options;
	db = log.debug();
	trace = entry.trace = {};
	requests = trace.requests = [];
	requires = trace.requires = [];
	if (db) log.debug({module: entry.relName}, 'tracing dependents of module');
	
	entry.dependents.forEach(function (name) {
		var dep, o_r, o_rs;
		dep = stream.getModuleFromName(name);
		if ((o_r = stream.requiredBy(entry, dep))) {
			required = true;
			requires.push(name);
			if (db) log.debug({module: entry.relName}, 'module is required by module %s', dep.relName);
		}
		if ((o_rs = stream.requestedBy(entry, dep))) {
			requested = true;
			requests.push(name);
			if (db) log.debug({module: entry.relName}, 'module is requested by module %s', dep.relName);
		}
		if (dep.trace.requested) o_requested = true;
		if (dep.trace.required) o_required = true;
		if (o_r && o_rs) utils.fatal('module %s is required and requested by module %s', entry.relName, dep.relName);
	});
	
	if (requested && !required) {
		// only requested, belongs to its own bundle
		entry.bundleName = stream.customNameFor(entry);
		trace.requested = true;
		if (db) log.debug({module: entry.relName, bundle: entry.bundleName}, 'module is only requested and separated into own bundle');
	} else {
		if (log.debug()) log.debug({module: entry.relName, trace: trace, o_requested: !! o_requested, o_required: !! o_required, requested: requested, required: required});
		// if the module is only required, we still need to verify if it should be packaged with
		// its normal bundle or in some cases along with a requested bundle
		if (o_required && !o_requested) {
			entry.bundleName = stream.getBundleNameFor(entry);
			trace.required = true;
			if (db) log.debug({module: entry.relName, bundle: entry.bundleName}, 'module is only required by statically required modules and will be handled normally');
		} else if (!o_required && o_requested) {
			// if only required by requested modules, determine if it should be packaged alongside
			// one of them (only one) or separated out and shared as a dependency amongst them
			if (requires.length > 1 || (requires.length && requests.length)) {
				// difficult scenario where it is required by a dynamically loaded module while also
				// requested by another dynamically loaded module so it cannot be placed with
				// either and becomes a hard dependency of the one that requires it
				entry.bundleName = stream.customNameFor(entry);
				trace.requested = true;
				requires.forEach(function (name) {
					var dep = stream.getBundleFor(name);
					if (!dep.hardDependencies) dep.hardDependencies = [];
					if (dep.hardDependencies.indexOf(entry.bundleName) === -1) {
						if (log.debug()) log.debug({bundle: dep.name}, 'adding bundle %s as a hard dependency', entry.bundleName);
						dep.hardDependencies.push(entry.bundleName);
					}
				});
			} else if (requires.length === 1 && !requests.length) {
				entry.bundleName = stream.getModuleFromName(requires[0]).bundleName;
				trace.requested = true;
				if (db) log.debug({module: entry.relName, bundle: entry.bundleName}, 'module is required by only one dynamically loaded module and will be bundled with it');
			} else {
				entry.bundleName = stream.customNameFor(entry);
				trace.requested = true;
				if (db) log.debug({module: entry.relName, bundle: entry.bundleName}, 'module is requested by dynamically requested modules and will be a shared dependency of those modules');
			}
		} else {
			entry.bundleName = stream.getBundleNameFor(entry);
			trace.required = true;
			if (db) log.debug({module: entry.relName, bundle: entry.bundleName}, 'module is required by both statically required and dynamically requested modules and will be handled normally');
		}
	}
};

proto.customNameFor = function (entry) {
	var opts, rel;
	opts = this.options;
	rel = entry.relName.replace(/\//g, '+');
	return entry.lib ? rel : util.format('%s+%s', path.basename(opts.package), rel);
};

proto.requestedBy = function (entry, dep) {
	return findIndex(dep.dependencies, function (e) { return e.name == entry.name && e.request; }) > -1;
};

proto.requiredBy = function (entry, dep) {
	return findIndex(dep.dependencies, function (e) { return e.name == entry.name && !e.request; }) > -1;
};