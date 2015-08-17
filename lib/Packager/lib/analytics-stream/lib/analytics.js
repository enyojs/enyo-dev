

// var w = 1280,
//     h = 800,
//     rx = w / 2,
//     ry = h / 2,
//     m0,
//     rotate = 0;
//
// var cluster = d3.layout.cluster()
// 	.size([360, ry - 120])
// 	.sort(function(a, b) { return d3.ascending(a.name, b.name); });
//
// var bundle = d3.layout.bundle();
//
// var line = d3.svg.line.radial()
// 	.interpolate('bundle')
// 	.tension(.85)
// 	.radius(function (d) { return d.y; })
// 	.angle(function (d) { return d.x / 180 * Math.PI; });
//
// var svg = d3
// 	.select('body')
// 	.append('svg')
// 	.attr('width', w)
// 	.attr('height', h)
// 	.append('g')
// 	.attr('transform', 'translate(' + rx + ',' + ry + ')');
//
// svg
// 	.append('path')
// 	.attr('class', 'arc')
// 	.attr('d', d3.svg.arc().outerRadius(ry - 120).innerRadius(0).startAngle(0).endAngle(2 * Math.PI));
//
// var nodes, links, splines;
//
// nodes = cluster.nodes(clusterNodes());
// links = layoutLinks(nodes);
// splines = bundle(links);
//
// svg
// 	.selectAll('path.link')
// 	.data(links)
// 	.enter()
// 	.append('path')
// 	.attr('class', function (d) { return 'link source-' + d.source.name + ' target-' + d.target.name; })
// 	.attr('d', function (d, i) {
// 		var ret = line(splines[i]); console.log(i, ret, splines[i]); return ret;
// 	});
//
// svg
// 	.selectAll('g.node')
// 	.data(nodes.filter(function (n) { return !n.children; }))
// 	.enter()
// 	.append('g')
// 	.attr('class', 'node')
// 	.attr('id', function (d) { return 'node-' + d.name; })
// 	.attr('transform', function (d) { return 'rotate(' + (d.x - 90) + ')translate(' + d.y + ')'; })
// 	.append('text')
// 	.attr('dx', function (d) { return d.x < 180 ? 8 : -8; })
// 	.attr('dy', '.31em')
// 	.attr('text-anchor', function (d) { return d.x < 180 ? 'start' : 'end'; })
// 	.attr('transform', function (d) { return d.x < 180 ? null : 'rotate(180)'; })
// 	.text(function (d) { return d.name; });
//
//
// function clusterNodes () {
// 	var root = {children: []};
// 	data.bundles.forEach(function (bundle) {
// 		bundle.parent = root;
// 		root.children.push(bundle);
// 		bundle.modules.forEach(function (entry) {
// 			entry.parent = root;
// 			root.children.push(entry);
// 		});
// 	});
// 	return root;
// }
//
// function layoutLinks (nodes) {
// 	var map, result;
// 	map = {};
// 	result = [];
// 	nodes.forEach(function (node) {
// 		map[node.name] = node;
// 	});
// 	nodes.forEach(function (node) {
// 		if (node.dependencies) {
// 			node.dependencies.forEach(function (name) {
// 				result.push({source: node, target: map[name]});
// 			});
// 		}
// 	});
// 	return result;
// }