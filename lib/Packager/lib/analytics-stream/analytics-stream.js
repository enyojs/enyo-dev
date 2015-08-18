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
	var stream, bundles, store, opts;
	stream = this;
	bundles = this.bundles;
	store = this.store;
	opts = this.options;
	if (opts.analytics) {
		bundles.push(bundle);
		Object.keys(bundle.modules).forEach(function (name) {
			store[name] = bundle.modules[name];
		});
		next();
	} else {
		next(null, bundle);
	}
};

proto._flush = function (done) {
	var opts, stream;
	stream = this;
	opts = this.options;
	if (opts.analytics) {
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
	} else done();
};

proto.prepare = function () {
	var stream = this;
	return Promise.join(
		fs.readFileAsync(path.join(__dirname, 'lib', 'analytics.less'), 'utf8'),
		Promise.resolve(path.join(__dirname, 'lib', 'index.jade')),
		fs.readFileAsync(path.join(__dirname, 'lib', 'analytics.js'), 'utf8'),
		fs.readFileAsync(path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'd3', 'd3.min.js'), 'utf8'),
		fs.readFileAsync(path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'jquery', 'dist', 'jquery.min.js'), 'utf8'),
		function (style, tplPath, runtime, d3, jquery) {
			stream.style = style;
			stream.tpl = jade.compileFile(tplPath, {pretty: true});
			stream.runtime = runtime;
			stream.d3 = d3;
			stream.jquery = jquery;
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
			{contents: stream.dataString},
			{contents: stream.runtime},
			{contents: stream.jquery}
		];
		data.package = path.basename(opts.package);
		data.bundles = stream.getExposedBundles();
		data.modules = stream.getExposedModules();
		data.build = opts.production ? 'production' : 'development';
		data.library = opts.library;
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
	stream.data = data;
	stream.dataString = util.format(
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
	entry.entry = bundle.entry;
	entry.modules = [];
	bundle.order.forEach(function (name) {
		var mod, real;
		real = bundle.modules[name];
		mod = {};
		mod.name = real.relName;
		mod.entry = real.entry;
		mod.path = path.relative(opts.package, real.fullpath);
		mod.package = real.isPackage;
		mod.json = real.json;
		mod.packageFile = mod.package ? path.relative(opts.package, real.packageFile) : '';
		mod.main = path.relative(opts.package, real.main || real.fullpath);
		mod.assets = !real.assets ? [] : real.assets.map(function (file) {
			return path.relative(opts.package, file);
		});
		mod.styles = !real.styles ? [] : real.styles.map(function (file) {
			return path.relative(opts.package, file);
		});
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

proto.getExposedModules = function () {
	return this.data.modules;
};

proto.getExposedBundles = function () {
	return this.data.bundles;
};