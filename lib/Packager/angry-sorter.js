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
	
	var
		map = {},
		graph = {},
		sorted = [],
		evaluated = [],
		entry;
	
	// for simplicity we will build the map, then build the dependecy graph and
	// finally span the graph lines to determine the sorted set
	rows.forEach(function (row) {
		map[row.id] = row;
		
		if (row.deps) {
			row.dependencies = [];
			Object.keys(row.deps).forEach(function (key) {
				var depid = row.deps[key];
				row.dependencies.push(depid);
				if (!graph[depid]) graph[depid] = [];
				graph[depid].push(row.id);
			});
		}
		
		if (row.entry) entry = row;
	});
	
	if (entry) {
		
		if (entry.dependencies) {
			for (var i = 0, dep; i < entry.dependencies.length; ++i) {
				dep = entry.dependencies[i];
				if (evaluated.indexOf(dep) === -1) {
					evaluateId(dep);
				}
			}
			if (evaluated.indexOf(entry.id) === -1) sorted.push(entry);
		} else sorted.push(entry);
		
	} else logger.log('debug', 'no entry for sorting graph');
	
	function evaluateId (rowid) {
		var
			row = map[rowid],
			deps;

		if (evaluated.indexOf(rowid) > -1) {
			return;
		}

		if (!row.deps || !row.dependencies.length) {
			sorted.push(row);
			evaluated.push(rowid);
			if ((deps = graph[rowid])) {
				deps.forEach(function (depid) {
					var dep = map[depid];
					var idx = dep.dependencies.indexOf(row.id);
					dep.dependencies.splice(idx, 1);
					if (dep.dependencies.length === 0) {
						evaluateId(depid);
					}
				});
			}
		} else {
		
			var cpy = row.dependencies.slice();
			for (var i = 0, dep; i < cpy.length; ++i) {
				dep = cpy[i];
				evaluateId(dep);
			}
			
			evaluateId(rowid);
		}
	}

	logger.log('debug', 'sorted dependency graph of modules', sorted.map(function (row) { return row.id; }));
	return sorted;
}