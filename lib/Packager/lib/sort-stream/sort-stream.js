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
	var graph, lines, nodes, stream;
	stream = this;
	nodes = this.nodes;
	graph = {};
	lines = [];
	Object.keys(nodes).forEach(function (name) {
		var node, depends, deps;
		node = nodes[name];
		depends = node.dependents;
		deps = node.dependencies;
		if (depends.length) graph[name] = depends.slice();
		else if (!depends.length && !deps.length) {
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
	var remaining, stream, i, j, entries, node1, node2, key, name;
	stream = this;
	remaining = Object.keys(graph);
	if (remaining.length === 0) return true;
	
	for (i = 0; i < remaining.length; ++i) {
		key = remaining[i];
		entries = graph[key];
		for (j = 0; j < entries.length; ++j) {
			name = entries[j];
			this.logger.warn('\n%s <-> %s\n', key, name);
			// node1 = this.nodes[key];
			// node2 = this.nodes[name];
			// this.crossCheckBundles(node1, node2);
		}


		// this.logger.warn('\n%s -> %s\n', key, entries.join(', '));
	}
	
	// for (i = 0; i < remaining.length; ++i) {
	// 	entries = graph[remaining[i]];
	// 	for (j = 0; j < entries.length; ++j) {
	// 		node1 = this.nodes[entries[j]];
	// 		node2 = this.nodes[remaining[i]];
	// 		this.logger.warn('%s <----> %s', getName(node1), getName(node2));
	// 		this.findCircle(node1, node2);
	// 		// console.log(node1.dependencies);
	// 		// console.log(node2.dependencies);
	// 	}
	// }
	
	
	
	// remaining.forEach(function (name) {
	// 	var entries = graph[name];
	// 	console.log(name, entries);
	// });
	
	
	// remaining.forEach(function (name) {
	// 	var entries = graph[name];
	// 	entries.forEach(function (dep) {
	// 		if (!left[dep]) left[dep] = [];
	// 		if (left[dep].indexOf(name) === -1) left[dep].push(name);
	// 	});
	// });
	// this.logger.warn('%d circular dependencies were encountered', Object.keys(left).length);
	// Object.keys(left).forEach(function (name) {
	// 	stream.findCircle(name, left[name]);
	// });
};

// proto.crossCheckBundles = function (node1, node2) {
// 	var deps1, deps2, order1, order2, common1, common2, stream;
// 	stream = this;
// 	order1 = node1.order;
// 	order2 = node2.order;
// 	common1 = [];
// 	common2 = [];
// 	deps1 = node1.order.map(function (name) {
// 		return node1.modules[name].dependencies.map(e);
// 	}).reduce(function (prev, curr) {
// 		if (!prev) return curr;
// 		return prev.concat(curr);
// 	});
// 	deps2 = node2.order.map(function (name) {
// 		return node2.modules[name].dependencies.map(e);
// 	}).reduce(function (prev, curr) {
// 		if (!prev) return curr;
// 		return prev.concat(curr);
// 	});
// 	deps1.forEach(function (dep) {
// 		if (order2.indexOf(dep) > -1) common1.push(dep);
// 	});
// 	deps2.forEach(function (dep) {
// 		if (order1.indexOf(dep) > -1) common2.push(dep);
// 	});
// 	if (common1.length) {
// 		this.logger.warn('\nbundle %s depends on module %s from bundle %s\n', node1.name, common1.map(function (c) { return getName(node2.modules[c]); }).join(', '), node2.name);
// 	}
// 	if (common2.length) {
// 		this.logger.warn('\nbundle %s depends on module %s from bundle %s\n', node2.name, common2.map(function (c) { return getName(node1.modules[c]); }).join(', '), node1.name);
// 	}
//
// 	if (common1.length === 0) console.log(deps1);
// 	if (common2.length === 0) console.log(deps2);
// };

// proto.findCircle = function (node1, node2) {
// 	if (node1.isBundle || node2.isBundle) return this.findBundleCircle(node1, node2);
//
//
//
// 	// var nodes, stream;
// 	// stream = this;
// 	// nodes = this.nodes;
// 	// console.error('findCircle: ', name, unresolved);
// 	// unresolved.forEach(function (uname) {
// 	// 	var unode, udeps, udep, i;
// 	// 	unode = nodes[uname];
// 	// 	udeps = unode.dependencies;
// 	// 	for (i = 0; i < udeps.length; ++i) {
// 	// 		udep = udeps[i];
// 	// 		if (typeof udep != 'string') udep = udep.name;
// 	// 		// console.error('calling trace', udep, name);
// 	// 		// stream.trace(udep, name);
// 	// 		stream.logger.warn(name, unresolved);
// 	// 	}
// 	// });
// };

// proto.findBundleCircle = function (node1, node2) {
// 	var msg = '\n%s -> %s\n%s -> %s\n';
// 	if (
// 		node1.dependencies.indexOf(node2.name) > -1 &&
// 		node2.dependencies.indexOf(node1.name) > -1
// 	) {
// 		this.logger.warn('\n%s and %s directly depend on eachother\n', getName(node1), getName(node2));
// 	} else {
// 		msg = util.format(
// 			msg,
// 			getName(node1),
// 			this.getPath(node1, node2).map(getName).join(' -> '),
// 			getName(node2),
// 			this.getPath(node2, node1).map(getName).join(' -> ')
// 		);
// 		this.logger.warn(msg);
// 	}
// };

// proto.getPath = function (node1, node2, p) {
// 	// console.log('getPath', node1 ? node1.name : 'NONE', node2 ? node2.name : 'NONE', p ? p.map(e) : 'empty');
// 	var deps, nodes, node;
// 	deps = node1.dependencies.map(e);
// 	nodes = this.nodes;
// 	p = p || [];
// 	if (deps.indexOf(node2.name) === -1) {
// 		for (var i = 0; i < deps.length; ++i) {
// 			node = nodes[deps[i]];
// 			if (this.isInPathTo(node, node2)) {
// 				p.push(node);
// 				this.getPath(node, node2, p);
// 			}
// 		}
// 	} else p.push(node2);
// 	return p;
// };

// proto.isInPathTo = function (node1, node2) {
// 	// console.log('isInPathTo', node1 ? node1.name : 'NONE', node2 ? node2.name : 'NONE');
// 	var deps, nodes, node;
// 	deps = node1.dependencies.map(e);
// 	nodes = this.nodes;
// 	if (node1.dependencies.length === 0) return false;
// 	else if (deps.indexOf(node2.name) > -1) return true;
// 	else {
// 		for (var i = 0; i < deps.length; ++i) {
// 			node = nodes[deps[i]];
// 			if (this.isInPathTo(node, node2)) return true;
// 		}
// 		return false;
// 	}
// };
