'use strict';

var
	util = require('util'),
	path = require('path');

var
	findIndex = require('find-index');

var
	logger = require('../../../logger'),
	utils = require('../../../utils'),
	hasher = require('../hasher');

var
	Transform = require('stream').Transform;

var
	log = logger.child({component: 'factor-source-stream'});

module.exports = FactorSourceStream;

function FactorSourceStream (opts) {
	if (!(this instanceof FactorSourceStream)) return new FactorSourceStream(opts);
	
	opts = opts || {};
	this.options = opts;
	
	log.level(opts.logLevel);
	
	this._modules = {};
	this._order = [];
	this._origins = {};
	this._bundles = {};
	
	Transform.call(this, {objectMode: true});
}

util.inherits(FactorSourceStream, Transform);

FactorSourceStream.prototype._shouldIgnore = function (nom) {
	var
		opts = this.options,
		skip = opts.skip,
		externals = opts.externals,
		bundles = this._bundles,
		bundle = bundles[nom],
		ret = bundle ? ((skip && skip.indexOf(nom) > -1) || (!opts.externals && bundle.external)) : false;
	log.info({bundle: nom}, 'will%s be ignored', ret ? '' : ' not');
	return ret;
};

FactorSourceStream.prototype._transform = function (entry, nil, next) {
	this._order.push(entry.name);
	this._modules[entry.name] = entry;
	next();
}

FactorSourceStream.prototype._flush = function (done) {
	
	var
		opts = this.options;
	
	if (opts.isLibrary) {
		this._factorLibrary();
	} else {
		this._factorModules();
		this._factorBundles();
	}
	
	this.push(null);
	done();
}

FactorSourceStream.prototype._factorModules = function () {
	var
		modules = this._modules,
		order = this._order;
	// we will factor them in reverse order to ensure that we create the root bundles before
	// they are needed
	for (var i = order.length - 1; i >= 0; --i) this._factorModule(modules[order[i]]);
};

FactorSourceStream.prototype._factorDependents = function (entry) {

	log.debug({module: entry.relName}, 'factoring dependents');

	var
		modules = this._modules,
		requests = entry.dependents.requests = [],
		requires = entry.dependents.requires = [],
		dep, sub, idx;
	
	for (var i = 0; i < entry.dependents.length; ++i) {
		sub = null;
		dep = modules[entry.dependents[i]];
		
		if (!dep) {
			utils.streamError(this, 'cannot find module %s from %s', entry.dependents[i], entry.relName);
		}
		
		// determine if the entry is a requested or required dependency of the dependent
		for (var j = 0; j < dep.dependencies.length; ++j) {
			if ((sub = dep.dependencies[j]).name == entry.name) {
				if (sub.request) requests.push(dep.name);
				else requires.push(dep.name);
				break;
			}
		}
		
		if (!sub) utils.streamError(this, 'cannot find dependency entry of %s in dependent %s', entry.relName, dep.relName);
	}
};

FactorSourceStream.prototype._factorRequired = function (entry) {
	// need to determine one of 3 cases - either all dependents are required, requested or a mixed
	// case which is actually a fail
	var
		origins = entry.origins = this._getOrigins(entry),
		requested = origins.requested,
		required = origins.required;
	
	if (requested && required) {
		// this is a fail case because apparently it was intended that this module be factored out
		// into its own bundle but it can't be
		log.info({module: entry.relName}, 'has been required and requested but was required by a core module');
		if (log.debug()) log.debug({module: entry.relName, required: origins.requiredBy, requested: origins.requestedBy});

		this._bundle(entry);
	} else if (requested && !required) {
		// all of the dependent roots were requested so we need to determine if there is only one
		// or multiple in which case it becomes more complicated
		if (origins.requestedBy.length === 1) {
			log.info({module: entry.relName}, 'included with requested bundle of %s', origins.requestedBy[0]);
			this._bundle(entry, origins.requestedBy[0]);
		} else {
			log.info({module: entry.relName}, 'factored into its own bundle as a dependency of multiple other bundles that request it');
			if (log.debug()) log.debug({module: entry.relName, requests: origins.requestedBy});
			entry.bundle = true;
			this._makeBundle(entry, origins.requestedBy);
			this._bundle(entry);
		}
	} else if (required && !requested) {
		log.info({module: entry.relName}, 'only required, included with its core bundle');
		this._bundle(entry);
	} else utils.streamError(this, 'could not determine origin point for module %s', entry.relName);
};

FactorSourceStream.prototype._getOrigins = function (entry) {
	
	if (this._origins[entry.name]) return this._origins[entry.name];
	
	var
		modules = this._modules,
		deps = entry.dependents.slice(),
		visited = [],
		required = null,
		requested = null,
		requestedBy = [],
		requiredBy = [],
		dep;

	log.info({module: entry.relName}, 'evaluating origins');
	if (log.debug()) log.debug({module: entry.relName, dependents: entry.dependents});
	
	while (deps.length) {
		dep = modules[deps.shift()];
		if (visited.indexOf(dep.name) === -1) {
			log.debug({module: entry.relName}, 'visiting dependent %s', dep.name);
			visited.push(dep.name);
			if (entry.request) {
				if (entry.dependents.requests.indexOf(dep.name) > -1) {
					// an entry for this module will already be made in the module's bundle
					if (log.debug()) log.debug({module: entry.relName}, 'dependent %s was a direct requestor and is being ignored', dep.name);
					continue;
				}
			}
			// if it doesn't have dependents we assume it is a required entry
			if (!dep.dependents.length) {
				if (log.debug()) log.debug({module: entry.relName}, 'dependent %s had no dependents of its own, setting required flag', dep.name);
				required = true;
				requiredBy.push(dep.name);
			}
			else {
				if (dep.request) {
					if (log.debug()) log.debug({module: entry.relName}, 'dependent %s is a requested module, setting requested flag', dep.name);
					// we don't pursue the dependents of the requested module because it doesn't
					// matter, we know it will have been required by this requested module
					requested = true;
					requestedBy.push(dep.name);
				} else {
					if (log.debug()) log.debug({module: entry.relName}, 'dependent %s was required directly, evaluating its dependents', dep.name);
					// we don't know for sure if it is required only we have to keep exploring
					deps = deps.concat(dep.dependents);
				}
			}
		} else if (log.debug()) log.debug({module: entry.relName}, 'dependent %s has already been visited, skipping', dep.name);
	}
	
	var ret = this._origins[entry.name] = {required: required, requested: requested, requestedBy: requestedBy, requiredBy: requiredBy};
	if (log.debug()) log.debug({module: entry.relName, origins: ret});
	return ret;
};

FactorSourceStream.prototype._factorRequested = function (entry) {
	
	var
		origins = this._getOrigins(entry),
		requested = origins.requested,
		required = origins.required;
	
	if (!required) {
		
		log.info({module: entry.relName}, 'required and requested by multiple modules which usually ' +
			'indicates an accidental require; it will be factored into its own bundle but ' +
			'will be a hard dependency of bundles that required it as opposed to requesting it');
		
		entry.bundle = true;
		
		if (origins.requestedBy.length === 1) {
			log.info({module: entry.relName}, 'required and requested but only requested by one bundle (from module %s)', origins.requestedBy[0]);
			this._makeBundle(entry, entry.dependents.requires.length ? entry.dependents.requires : null);
		} else {
			log.info({module: entry.relName}, 'required and requested by multiple bundles');
			this._makeBundle(entry, entry.dependents.requires);
		}
		this._bundle(entry);
		return true;
	}
};

FactorSourceStream.prototype._makeBundle = function (entry, dependents) {
	
	var
		opts = this.options,
		modules = this._modules,
		bundles = this._bundles,
		bundleName = this._getBundleName(entry),
		bundle, mod, i;
	
	bundle = bundles[bundleName];
	if (!bundle) {
		log.info({module: entry.relName, bundle: bundleName}, 'making bundle');
		bundle = bundles[bundleName] = {
			name: bundleName,
			fullpath: entry.bundle ? entry.fullpath : (entry.lib || entry.fullpath),
			modules: {},
			order: [],
			dependencies: [],
			entries: [],
			request: !! entry.bundle,
			external: opts.isLibrary ? false : (!! entry.libName),
			isBundle: true
		};
		bundle.ignore = this._shouldIgnore(bundleName);
	} else log.debug({module: entry.relName, bundle: bundleName}, 'bundle already existed');
	
	// this will be the list of dependent modules from outside of the bundle for tracing back to
	// to hard dependencies of one bundle to another especially in the case where a requested module
	// has been required in another requested bundle - this current bundle will now be an async
	// hard dependency of that bundle but we wait until the end when all the bundles have been
	// determined before setting that up
	if (dependents) {
		
		log.info({module: entry.relName, bundle: bundle.name}, 'has hard dependents');
		
		if (!bundle.hard_dependents) bundle.hard_dependents = [];
		
		for (i = 0; i < dependents.length; ++i) {
			mod = dependents[i];
			mod = modules[mod];
			if (!bundle.hard_dependents.length || bundle.hard_dependents.indexOf(mod.name) === -1) {
				log.info({module: entry.relName, bundle: bundle.name}, 'adding hard dependent %s for later factoring', mod.relName);
				bundle.hard_dependents.push(mod.name);
			}
		}
	}
	
	return bundle;
};

FactorSourceStream.prototype._bundle = function (entry, target) {
	
	var
		modules = this._modules,
		bundles = this._bundles,
		bundle, bundleName;
	
	if (target) {
		target = modules[target];
	} else {
		target = entry;
	}
	
	bundleName = this._getBundleName(target);
	if (target !== entry) entry.bundleName = bundleName;
	
	log.info({module: entry.relName, bundle: bundleName}, 'adding module to bundle');
	
	bundle = bundles[bundleName] || this._makeBundle(target);
	// remember they are being processed in reverse order
	bundle.order.unshift(entry.name);
	bundle.modules[entry.name] = entry;
	if (entry.entry && bundle.entries.indexOf(entry.name) === -1) {
		bundle.entries.unshift(entry);
		// we flag it as a bundle with an entry -- helps in fail-case for sorting
		bundle.entry = true;
	}
};

FactorSourceStream.prototype._getBundleName = function (entry) {
	return entry.bundleName || (entry.bundleName = (
		entry.bundle ? ((entry.libName ? (entry.libName + '_') : '') + path.basename(entry.name) + (entry.libName ? '' : hasher(entry.fullpath))) : (entry.libName || path.basename(this.options.cwd))
	));
};

FactorSourceStream.prototype._factorModule = function (entry) {
	
	this._factorDependents(entry);
	
	if (entry.dependents.requires.length && !entry.dependents.requests.length) {
		// standard case, always required, next determine if the dependents are all required
		// or if they are requested
		this._factorRequired(entry);
	}
	
	else if (entry.dependents.requests.length && !entry.dependents.requires.length) {
		
		log.info({module: entry.relName}, 'only requested, factored into its own bundle');
		
		// the module was only ever requested so it can be separated into its own bundle
		entry.bundle = true;
		this._makeBundle(entry);
		this._bundle(entry);
	}
	
	else if (entry.dependents.requests.length && entry.dependents.requires.length) {
		// the module was directly required and requested so we have to determine if it is still
		// possible to be loaded asynchronously
		if (!this._factorRequested(entry)) {
			// it failed to be factored as a requested module because it was required by a module
			// that will be bundled synchronously, usually unintentional (should be assumed...)
			
			log.info({module: entry.relName}, 'was required and requested but cannot be factored ' +
				'into its own bundle because a module that requires it is included by a core bundle');
			
			this._bundle(entry);
		}
		
	} else {
		
		log.info({module: entry.relName}, 'no dependents and will be bundled with its core bundle');
		this._bundle(entry);
	}
};

FactorSourceStream.prototype._factorBundles = function () {
	var
		stream = this,
		bundles = this._bundles,
		modules = this._modules,
		graph = {};

	log.info('factoring bundles in preparationg for deterministically sorting them');
	
	Object.keys(bundles).forEach(function (bundleName) {
		
		log.debug({bundle: bundleName}, 'factoring %s', bundleName);
		
		var
			bundle = bundles[bundleName],
			seen = [];
		
		if (!bundle) utils.streamError(stream, 'bundle %s is missing', bundleName);
		
		if (!bundle.dependents) bundle.dependents = graph[bundleName] || (graph[bundleName] = []);
		
		Object.keys(bundle.modules).forEach(function (moduleName) {
			
			var
				mod = modules[moduleName],
				rName, rBundle, rGraph;
			
			if (!mod) utils.streamError(stream, 'module %s is missing (expected to be a part of bundle %s)', moduleName, bundleName);
			
			// we attempt to determine the bundle's own bundle-dependencies based on the modules
			// it contains
			mod.dependencies.forEach(function (e) {
				var dep = modules[e.name];
				
				if (!dep) utils.streamError(stream, 'module %s is missing, dependency of module %s in the %s bundle', e.name, mod.relName, bundleName);
				
				rName = dep.bundleName;
				
				if (seen.indexOf(rName) > -1) return;
				seen.push(rName);
				
				if (rName) {
					if (rName != bundleName) {
						rBundle = bundles[rName];
						
						if (!rBundle) utils.streamError(stream, 'bundle %s is missing as a dependency of bundle %s', rName, bundleName);
						
						// this would create a circular dependency in some scenarios
						if (bundle.request && !rBundle.request) {
							log.info({module: mod.relName, bundle: bundleName}, 'dependency bundle %s is being skipped to avoid a circular dependency', rName);
						} else if (bundle.dependencies.indexOf(rName) === -1) {
							log.info({module: mod.relName, bundle: bundleName}, 'dependency bundle %s being added to %s', rName, bundleName);
							bundle.dependencies.push(rName);
							rGraph = graph[rName] || (rBundle.dependents = graph[rName] = []);
							if (rGraph.indexOf(bundleName) === -1) {
								log.info({module: mod.relName, bundle: bundleName}, 'adding %s as a dependent of %s', bundleName, rName);
								rGraph.push(bundleName);
							}
						}
					}
				}
			});
			
		});
		
		if (bundle.hard_dependents && bundle.hard_dependents.length) {
			log.info({bundle: bundleName, hard_dependents: bundle.hard_dependents}, 'processing hard dependents');
			
			bundle.hard_dependents.forEach(function (depName) {
				
				var
					dep = modules[depName],
					rName, rBundle;
				
				if (!dep) utils.streamError(stream, 'module %s is missing (a hard dependent of bundle %s)', depName, bundleName);
				
				rName = dep.bundleName;
				rBundle = bundles[rName];
				
				if (!rBundle) utils.streamError(stream, 'bundle %s is missing (a hard dependent of bundle %s)', rName, bundleName);
				
				if (!rBundle.hard_dependencies) rBundle.hard_dependencies = [];
				if (rBundle.hard_dependencies.indexOf(bundleName) === -1) {
					log.info({bundle: bundleName}, 'adding %s as a hard dependency of bundle %s', bundleName, rName);
					rBundle.hard_dependencies.push(bundleName);
				}
				
			});
		}

		
	});
	
	// one last time we iterate through and ensure that their dependents are attached
	for (var nom in bundles) {
		this.push(bundles[nom]);
	}
};

FactorSourceStream.prototype._factorLibrary = function () {
	
	var
		modules = this._modules,
		bundles = this._bundles,
		entry, key;
	
	for (key in modules) {
		entry = modules[key];
		this._bundle(entry);
	}
	
	for (key in bundles) this.push(bundles[key]);
};