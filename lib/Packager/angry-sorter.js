'use strict';

var
	through = require('through2');

var
	logger = require('../logger');

module.exports = function (packager) {
	
	var
		rows = [];
	
	return through.obj(aggregate, end);
	
	function aggregate (row, nil, next) {
		rows.push(row);
		next();
	}
	
	function end (done) {
		var ret = sort(rows);
		ret.forEach(function (row) { this.push(row); }, this);
		packager.sorted = ret;
		done();
	}
};

function sort (rows) {
	
	// logger.log('debug', '///////// BEGIN SORTING');
	
	var
		// for directly accessing nodes by their id
		map = {},
		// for storing edges (dependent relationship)
		graph = {},
		nodes = [],
		sorted = [];
	
	// logger.log('debug', 'processing graph');
	
	rows.forEach(function (row) {
		map[row.id] = row;
		
		// because they are stored in an awkward way we have to do a little extra work
		if (row.deps && Object.keys(row.deps).length) {
			row.dependencies = [];
			Object.keys(row.deps).forEach(function (key) {
				var depid = row.deps[key];
				row.dependencies.push(depid);
				// now add an entry for this edge in the graph
				if (!graph[depid]) graph[depid] = [];
				graph[depid].push(row.id);
			});
			
			// logger.log('debug', '%s has %d dependencies', row.id, row.dependencies.length, row.dependencies);
			
		} else {
			
			// logger.log('debug', '%s has no dependencies', row.id);
			nodes.push(row);
		}
	});
	
	while (nodes.length) {
		var
			node = nodes.shift(),
			deps = graph[node.id];
		
		// logger.log('debug', 'adding %s because it has no dependencies', node.id);
		
		sorted.push(node);
		
		if (deps && deps.length) {
			// logger.log('debug', '%s had dependencies', node.id, deps);
			
			deps.forEach(function (depid) {
				var
					dep = map[depid],
					idx = dep.dependencies.indexOf(node.id);
				
				if (idx === -1) throw 'Error: Could not find ' + node.id + ' in dependencies of ' + depid;
				dep.dependencies.splice(idx, 1);
				if (dep.dependencies.length === 0) {
					// logger.log('debug', '%s was the last dependency of %s', node.id, depid);
					nodes.push(dep);
				}
				
			});
			
			delete graph[node.id];
		}
	}
	
	var cycles;
	
	if ((cycles = Object.keys(graph)).length) {
		logger.log('error', 'sorting failed with circular dependencies or unmet requirements', cycles);
	}
	
	
	// logger.log('debug', '///////// END SORTING (%d of %d)', sorted.length, rows.length, sorted.map(function (row) { return row.id; }));
	return sorted;
	
}