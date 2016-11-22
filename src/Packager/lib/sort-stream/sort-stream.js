'use strict';

var
	path = require('path'),
	util = require('util');

var
	Transform = require('stream').Transform;

var
	utils = require('../../../utils');


module.exports = SortStream;

function n (node) {
	return node.relName || node.name;
}

function e (d) {
	return typeof d == 'string' ? d : d.name;
}

function SortStream (opts) {
	if (!(this instanceof SortStream)) return new SortStream(opts);
	Transform.call(this, {objectMode: true});
	opts = opts || {};
	this.options = opts;
	this.logger = opts.logger.child({component: 'sort-stream'});
	this.logger.level(opts.logLevel);
	this.log = this.logger.debug.bind(this.logger);
	this.nodes = {};
}

util.inherits(SortStream, Transform);

var proto = SortStream.prototype;

proto._transform = function (node, nil, next) {
	this.nodes[node.name] = node;
	next();
};

proto._flush = function (done) {
	var stream = this;
	this.sort().forEach(function (node) { stream.push(node); });
	stream.push(null);
	done();
};

proto.sort = function () {
	var graph, lines, nodes, sorted, node, depends, resolved, opts;
	opts = this.options;
	nodes = this.nodes;
	graph = this.getGraph();
	lines = graph.lines;
	sorted = [];
	resolved = {};
	while (lines.length) {
		node = lines.shift();
		depends = graph[node.name];
		delete graph[node.name];
		if (depends && depends.length) {
			depends.forEach(function (name) {
				var dependent, found;
				dependent = nodes[name];
				found = resolved[name] || (resolved[name] = []);
				found.push(node);
				if (found.length === dependent.dependencies.length) lines.push(dependent);
			});
		}
		sorted.push(node);
	}
	if (!this.validateGraph(graph) && opts.strict) {
		utils.fatal('unable to continue, circular dependencies found and strict mode is enabled');
	}
	if (this.log()) {
		this.log(sorted.map(function (node) { return node.name; }));
	}
	return sorted;
};

proto.getGraph = function () {
	var graph, lines, nodes, stream, opts;
	stream = this;
	opts = this.options;
	nodes = this.nodes;
	graph = {};
	lines = [];
	Object.keys(nodes).forEach(function (name, i, array) {
		var node, depends, deps;
		node = nodes[name];
		depends = node.dependents;
		deps = node.dependencies;
		if (depends.length) graph[name] = depends.slice();
		else if (!depends.length && !deps.length && !opts.library && array.length > 1) {
			stream.logger.warn({node: n(node)}, 'has no dependents or dependencies and will be ignored');
			return;
		}
		if (!deps.length) lines.push(node);
	});
	Object.defineProperty(graph, 'lines', {
		value: lines,
		enumerable: false
	});
	return graph;
};

proto.validateGraph = function (graph) {
	var remaining, i, j, entries, key, name;
	remaining = Object.keys(graph);
	if (remaining.length === 0) return true;
	for (i = 0; i < remaining.length; ++i) {
		key = remaining[i];
		entries = graph[key];
		for (j = 0; j < entries.length; ++j) {
			name = entries[j];
			// @todo temporary, more complete needed
			this.logger.warn('\n%s <-> %s\n', key, name);
		}
	}
};
