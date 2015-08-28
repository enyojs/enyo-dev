'use strict';

var
	util = require('util'),
	path = require('path');

var
	Transform = require('stream').Transform;

var
	merge = require('merge'),
	defined = require('defined'),
	detective = require('detective'),
	findIndex = require('find-index'),
	uniq = require('array-uniq');

var
	defaultResolver = require('./lib/default-resolver'),
	nameResolver = require('./lib/name-resolver'),
	uriResolver = require('./lib/uri-resolver'),
	logger = require('../../../logger'),
	utils = require('../../../utils');

var NODE_BUILTINS = [
	'fs','path','vm','zlib','util','url','udp4','tty','tls','string_decoder','stream','repl',
	'readline','punycode','os','net','http','https','events','crypto','cluster','child_process',
	'buffer','assert'
];

var
	log = logger.child({component: 'process-source-stream'});

module.exports = ProcessSourceStream;

/**
*
* Options
*
*
*/
function ProcessSourceStream (opts) {
	if (!(this instanceof ProcessSourceStream)) return new ProcessSourceStream(opts);
	
	Transform.call(this, {objectMode: true});

	// like with all of the other streams in packager the options need to be setup elsewhere
	// to reduce unnecessary overhead of resolving them per-stream (unless later we find that
	// necessary for some reason)
	opts = opts || {};
	this.options = opts;
	
	log.level(opts.logLevel);

	this.preprocessors = opts.preprocessors = defined(opts.preprocessors, []);
	this.resolver = defined(opts.resolver, defaultResolver);
	
	if (this.resolver.reset) this.resolver.reset();
	
	this._resolving = 0;
	this._resolvingNames = {};
	this._queue = [];
	this._modules = {};
	this._graph = {};
	this._skipped = [];
	this._errored = [];
	this.libs = {};
	// this method is invoked asynchronously many times
	this._resolved = this._resolved.bind(this);
}

util.inherits(ProcessSourceStream, Transform);

ProcessSourceStream.prototype._transform = function (entry, nil, next) {
	
	// if entries are being added from a cache they will already be resolved so we build the table
	// as we go so we can quick-reference it later
	if (entry.resolved) {
		this._modules[entry.name] = entry;
		entry.cached = true;
	} else this._queue.push(entry);
	next();
};

ProcessSourceStream.prototype._flush = function (done) {
	
	var
		stream = this,
		queue = this._queue,
		modules = this._modules,
		flush;
	
	flush = function () {
		stream._finalize();
		stream.push(null);
		done();
	};
	
	while (queue.length) {
		var entry = queue.shift();
		if (typeof entry == 'string') entry = {path: entry};
		if (entry.resolved) {
			log.info({module: entry.relName}, 'evaluating already resolved cached entry');
			stream._resolving++;
			stream._resolved(null, entry);
		} else stream._resolve(entry);
	}
	
	if (this._resolving === 0) flush();
	else this.once('done', flush);
};

ProcessSourceStream.prototype._resolve = function (entry) {
	
	var
		stream = this,
		skipped = this._skipped,
		errored = this._errored,
		resolver = this.resolver,
		modules = this._modules,
		names = this._resolvingNames,
		opts = this.options,
		done = function () { if (--stream._resolving === 0 && stream._queue.length === 0) stream.emit('done'); },
		otr;
	
	stream._resolving++;
	stream._resolveName(entry);
	
	log.info({module: entry.relName}, 'resolving');
	
	// ensure that we have not already resolved this module
	if ((otr = modules[entry.name])) {
		if (otr.cached) {
			log.debug({module: entry.relName}, 'using cached entry for %s', entry.relName);
			delete otr.cached;
			stream._queue.push(otr);
		} else log.debug({module: entry.relName}, 'already resolved, skipping');
		return done();
	}
	
	// ensure we aren't already resolving the entry
	else if (names[entry.name]) {
		log.debug({module: entry.relName}, 'already resolving, skipping');
		return done();
	}
	
	else if (skipped.indexOf(entry.name) > -1) {
		log.debug({module: entry.relName}, 'flagged as skipped, skipping');
		return done();
	}
	
	else if (errored.indexOf(entry.name) > -1) {
		log.debug({module: entry.relName}, 'flagged as having errored already, skipping');
		return done();
	}
	
	names[entry.name] = entry;
	resolver(entry, opts, this.libs, this._resolved);
};

ProcessSourceStream.prototype._resolved = function (err, entry) {
	
	var
		stream = this,
		skipped = this._skipped,
		errored = this._errored,
		modules = this._modules,
		names = this._resolvingNames,
		done = function () { if (--stream._resolving === 0) stream.emit('done'); };
	
	if (err) {
		if (NODE_BUILTINS.indexOf(entry.name) > -1) {
			log.debug({module: entry.relName}, 'is a built-in Node.js module and will be skipped');
			if (skipped.indexOf(entry) === -1) skipped.push(entry);
			return done();
		}

		log.error(err, {module: entry.relName}, 'could not be resolved, will be reported at the end');
		if (errored.indexOf(entry) === -1) errored.push(entry);
		return done();
	}
	
	names[entry.name] = null;
	modules[entry.name] = entry;
	
	log.info({module: entry.relName}, 'resolved at %s', entry.relPath);
	
	if (typeof entry.contents == 'string') {
		// if/when we cache this it will store only the raw form so that if it was modified we will
		// modify it again next time based on the given settings that may change it
		entry.rawContents = entry.contents;
		// if this was a cached entry then we don't need to re-parse it
		if (!entry.resolved) {
			
			log.info({module: entry.relName}, 'parsing module contents for require/request statements');
			
			try {
				entry.requires = uniq(detective(entry.contents));
				entry.requests = uniq(detective(entry.contents, {word: 'request'}));
			} catch (e) {
				return utils.fatal('failed to parse file %s', entry.fullpath);
			}
			
			log.info({module: entry.relName}, 'parsing module contents for expandable URI paths');
		}
	}
	
	// we reset these every time, even for cached modules
	entry.dependencies = [];
	
	if (entry.requires.length || entry.requests.length) {
		log.info({module: entry.relName}, '%d requires, %d requests', entry.requires.length, entry.requests.length);
		entry.requires.forEach(function (dep) {
			dep = stream._dependency(entry, dep);
			if (dep) entry.dependencies.push(dep);
		});
		entry.requests.forEach(function (dep) {
			dep = stream._dependency(entry, dep, true);
			if (dep) entry.dependencies.push(dep);
		});
	}
	
	entry.resolved = true;
	
	done();
};

ProcessSourceStream.prototype._dependency = function (entry, dep, request) {
	
	var
		stream = this,
		opts = this.options,
		modules = this._modules,
		names = this._resolvingNames,
		graph = this._graph,
		base = path.dirname(entry.isPackage ? entry.main : entry.fullpath),
		next, name, ret, known, deps;

	next = {
		path: dep,
		base: base
	};
	
	if (entry.external) next.external = true;
	if (entry.lib) next.lib = entry.lib;
	if (entry.libName) next.libName = entry.libName;
	name = stream._resolveName(next);
	ret = {name: name, alias: dep};
	
	deps = graph[name] || (graph[name] = []);
	if (deps.indexOf(entry.name) === -1) {
		log.debug({module: next.relName}, 'adding dependent %s', entry.relName);
		deps.push(entry.name);
	}
	
	if (request) {
		log.debug({module: next.relName}, 'flagged as a request when included by %s', entry.relName);
		next.request = ret.request = true;
	}
	
	if ((known = modules[name])) {
		if (known.cached) {
			log.debug({module: known.relName}, 'required cached entry %s needs to be evaluated', known.relName);
			delete known.cached;
			stream._queue.push(known);
		} else {
			log.debug({module: known.relName}, 'already resolved dependency of %s', entry.relName);
		}
		if (request) known.request = true;
		return ret;
	}
	
	else if ((known = names[name])) {
		log.debug({module: next.relName}, 'already resolving dependency of %s', entry.relName);
		if (request) known.request = true;
		return ret;
	}
	
	if (!next.external || opts.externals) stream._resolve(next);
	else {
		log.debug({module: next.relName}, 'skipping external module');
		return null;
	}

	return ret;
};

ProcessSourceStream.prototype._resolveName = function (entry) {
	return (entry.name = entry.name || nameResolver(entry, this.options, this));
};

ProcessSourceStream.prototype._finalize = function () {
	
	log.info('final analysis of acquired modules');
	
	var
		modules = this._modules,
		graph = this._graph,
		skipped = this._skipped,
		errored = this._errored,
		nom, entry, i, j, idx, entries, skip, err, mod;
	
	log.debug('checking skipped entries %d', skipped.length);
	
	for (i = 0; i < skipped.length; ++i) {
		skip = skipped[i];
		entries = graph[skip.name];
		if (entries && entries.length) {
			
			log.debug('there were %d entries dependent on skipped module %s', entries.length, skip.relName);
			
			for (j = 0; j < entries.length; ++j) {
				mod = modules[entries[j]];
				
				log.warn({module: mod.relName}, 'unable to depend on skipped module %s', skip.relName);
				// note that we leave the original entry in the appropriate requests/requires array
				// primarily for debugging purposes but also for caching
				idx = findIndex(mod.dependencies, function (e) { return e.name == skip.name; });
				if (idx === -1) {
					utils.fatal('unable to locate dependency entry for skipped module %s from dependent module %s', skip.relName, mod.relName);
				}
				mod.dependencies.splice(idx, 1);
			}
		}
	}
	
	log.debug('checking errored entries %d', errored.length);
	
	for (i = 0; i < errored.length; ++i) {
		err = errored[i];
		entries = graph[err.name];
		if (entries && entries.length) {
			
			log.debug('there were %d entries dependent on errored module %s', entries.length, err.relName);
			
			for (j = 0; j < entries.length; ++j) {
				mod = modules[entries[j]];
				log.error({module: mod.relName}, 'dependency %s could not be found', err.relName);
			}
		}
	}
	
	// now that we reported all the associated errors, if there were any, we need to kill the stream
	if (errored.length) utils.fatal('cannot continue due to encountered errors');
	
	// ok, now its time to add the dependent graph information
	for (nom in modules) {
		mod = modules[nom];
		if (mod.cached) {
			// cached module (from cache file) that was never used, able to remove it now
			log.debug({module: mod.relName}, 'removing unused cached module %s', mod.relName);
			continue;
		}
		entries = graph[nom];
		if (entries && entries.length) mod.dependents = entries;
		else mod.dependents = [];
		
		// @todo eventually it would be helpful to instead expose this as a feature much like the
		// less plugin support
		if (mod.contents) {
			try {
				uriResolver(mod, this.options, this);
			} catch (e) {
				utils.fatal('failed to parse file %s for expandable URI paths:\n\t\t%s', mod.fullpath, e.message);
			}
		}
		
		this.push(mod);
	}
};