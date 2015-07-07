'use strict';

var
	util = require('util'),
	path = require('path');

var
	findIndex = require('find-index');

var
	logger = require('../../../logger'),
	utils = require('../../../utils');

var
	Transform = require('stream').Transform;

var
	log = logger.child({component: 'sort-stream'});

module.exports = SortStream;

function SortStream (opts) {
	if (!(this instanceof SortStream)) return new SortStream(opts);
	
	Transform.call(this, {objectMode: true});
	this._store = {};
	opts = opts || {};
	this.options = opts;
	
	log.level(opts.logLevel);
}

util.inherits(SortStream, Transform);

SortStream.prototype._transform = function (entry, nil, next) {
	var store = this._store;
	store[entry.name] = entry;
	if (entry.isBundle) this._bundles = true;
	next();
};

SortStream.prototype._flush = function (done) {
	
	var
		stream = this;
	
	this.sort().forEach(function (entry) { stream.push(entry); });
	this.push(null);
	done();
};

SortStream.prototype.sort = function () {
	
	var
		map = this._store,
		stream = this,
		opts = this.options,
		graph = {},
		nodes = [],
		sorted = this._sorted = [],
		cycles;
	
	Object.keys(map).forEach(function (nom) {
		
		var
			entry = map[nom],
			deps = entry.dependents;
		
		if (!deps || !deps.length) {
			if (!entry.entry) {
				log.debug(stream._bundles ? {bundle: entry.name} : {module: entry.relName}, 'is an orphaned entry with no dependents and is being disregarded');
				return;
			}
		} else graph[entry.name] = entry.dependents.slice();
		
		deps = entry.dependencies;
		if (deps && deps.length) {
			log.debug(stream._bundles ? {bundle: entry.name} : {module: entry.relName}, 'has %d dependencies and is being added to the graph', deps.length, {dependencies: deps});
		} else {
			log.debug(stream._bundles ? {bundle: entry.name} : {module: entry.relName}, 'has no dependencies and is being added as a starting node');
			nodes.push(entry);
		}
	});
	
	while (nodes.length) {
		var
			node = nodes.shift(),
			deps = graph[node.name];
		
		delete graph[node.name];
		
		log.debug(stream._bundles ? {bundle: node.name} : {module: node.relName},
			'processing node, %d dependents',
			deps ? deps.length : 0
		);
		
		if (deps && deps.length) {
			
			deps.forEach(function (dep) {
				var found;
				
				dep = map[dep];
				found = dep.found || (dep.found = []);
				found.push(node);
				
				if (found.length === dep.dependencies.length) {
					
					log.debug(stream._bundles ? {bundle: node.name} : {module: node.relName},
						'dependent %s is ready to be processed (found=%d, dependencies=%d)',
						dep.relName || dep.name,
						found.length,
						dep.dependencies.length
					);
					
					nodes.push(dep);
				}
			});

		}

		log.debug(stream._bundles ? {bundle: node.name} : {module: node.relName}, 'sorted');
		delete node.found;
		sorted.push(node);
	}
	
	if ((cycles = Object.keys(graph)).length) {
		var msg = 'unmet or circular dependencies:\n';
		cycles.forEach(function (nom) {
			var cycle = graph[nom];
			msg += ('\t' + nom + ' ⤆ ' + cycle.join(', ') + '\n');
		});
		utils.streamError(stream, msg);
	}
	
	if (log.debug()) log.debug('final sorted deterministic ordering', {order: sorted.map(function (e) { return e.relName || e.name; })});
	return sorted;
};