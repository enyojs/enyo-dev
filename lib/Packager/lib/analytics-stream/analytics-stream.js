'use strict';

var
	util = require('util'),
	path = require('path');

var
	Transform = require('stream').Transform,
	Promise = require('bluebird');

var
	fs = Promise.promisifyAll(require('fs-extra')),
	lessc = require('less'),
	jade = require('jade');

var
	logger = require('../../../logger');

var
	log = logger.child({component: 'analytics-stream'});

module.exports = AnalyticsStream;

function AnalyticsStream (opts) {
	if (!(this instanceof AnalyticsStream)) return new AnalyticsStream(opts);
	Transform.call(this, {objectMode: true});
	opts = opts || {};
	this.options = opts;
	this.bundles = [];
	this.store = {};
	this.tpl = function () {};
	this.style = '';
	this.runtime = '';
	this.data = '';
	this.d3 = '';
}

util.inherits(AnalyticsStream, Transform);

var proto = AnalyticsStream.prototype;

proto._transform = function (bundle, nil, next) {
	var stream, bundles, store;
	stream = this;
	bundles = this.bundles;
	store = this.store;
	bundles.push(bundle);
	Object.keys(bundle.modules).forEach(function (name) {
		store[name] = bundle.modules[name];
	});
	next();
};

proto._flush = function (done) {
	var stream = this;
	this.prepare().then(function () {
		return stream.analyze();
	}).then(function () {
		return stream.publish();
	}).then(function () {
		stream.bundles.forEach(function (bundle) {
			stream.push(bundle);
		});
		stream.push(null);
	}).then(done);
};

proto.prepare = function () {
	var stream = this;
	return Promise.join(
		fs.readFileAsync(path.join(__dirname, 'lib', 'analytics.less'), 'utf8'),
		fs.readFileAsync(path.join(__dirname, 'lib', 'index.tpl'), 'utf8'),
		fs.readFileAsync(path.join(__dirname, 'lib', 'analytics.js'), 'utf8'),
		fs.readFileAsync(path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'd3', 'd3.min.js'), 'utf8'),
		function (style, tpl, runtime, d3) {
			stream.style = style;
			stream.tpl = jade.compile(tpl, {pretty: true});
			stream.runtime = runtime;
			stream.d3 = d3;
		}
	);
};

proto.publish = Promise.method(function () {
	var opts, stream, outfile, data, contents, tpl;
	stream = this;
	opts = this.options;
	outfile = path.join(opts.package, 'analytics.html');
	data = {};
	tpl = this.tpl;
	return this.renderStyle().then(function (style) {
		data.stylesheets = [{contents: style}];
		data.scripts = [
			{contents: stream.d3},
			{contents: stream.data},
			{contents: stream.runtime}
		];
		data.package = path.basename(opts.package);
		data.moduleCount = Object.keys(stream.store).length;
		data.bundleCount = stream.bundles.length;
		data.bundles = stream.bundles;
		data.modules = stream.getModulesArray();
		contents = tpl(data);
		return fs.writeFileAsync(outfile, contents, {encoding: 'utf8'}).then(function () {
			if (log.info()) log.info('analytics file written to %s', path.relative(opts.cwd, outfile));
		});
	});
});

proto.renderStyle = function () {
	var stream = this;
	return lessc.render(this.style).then(function (compiled) {
		return compiled.css;
	});
};

proto.analyze = Promise.method(function () {
	var data, stream, store, bundles;
	data = {bundles: [], modules: []};
	stream = this;
	store = this.store;
	bundles = this.bundles;
	bundles.forEach(function (bundle) {
		stream.process(bundle, data);
	});
	stream.data = util.format(
		'\nvar data = %s;\n',
		JSON.stringify(data, null, 2)
	);
});

proto.process = function (bundle, data) {
	var entry, opts, stream;
	stream = this;
	entry = {};
	opts = this.options;
	entry.name = bundle.name;
	entry.modules = [];
	bundle.order.forEach(function (name) {
		var mod, real;
		real = bundle.modules[name];
		mod = {};
		mod.name = real.relName;
		mod.path = path.relative(opts.package, real.fullpath);
		mod.bundle = bundle.name;
		mod.dependencies = real.dependencies.map(function (dep) {
			return stream.getModuleForName(dep.name).relName;
		});
		mod.dependents = real.dependents.map(function (dep) {
			return stream.getModuleForName(dep).relName;
		});
		entry.modules.push(mod);
		data.modules.push(mod);
	});
	entry.dependencies = bundle.dependencies;
	entry.dependents = bundle.dependents;
	data.bundles.push(entry);
};

proto.getModuleForName = function (name) {
	return this.store[name];
};

proto.getModulesArray = function () {
	var store = this.store;
	return Object.keys(store).map(function (name) { return store[name]; });
};