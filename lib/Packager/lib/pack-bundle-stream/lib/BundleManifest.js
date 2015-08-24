'use strict';

var
	path = require('path'),
	util = require('util');

var
	MODULE_START     = '[function (module,exports,global,require,request){\n',
	MODULE_BODY_END  = '\n}',
	MODULE_END       = ']',
	MODULE_MAP_START = ',{',
	MODULE_MAP_END   = '}',
	MANIFEST_START   = 'manifest = {',
	MANIFEST_END     = '\n\t};\n'

module.exports = BundleManifest;

function BundleManifest (bundler, bundle, opts, map, line) {
	this.options = opts;
	this.bundler = bundler;
	this.bundle = bundle;
	this.package = opts.package;
	this.head = MANIFEST_START;
	this.tail = MANIFEST_END;
	this.modules = [];
	this.requests = [];
	this.bundles = [];
	this.map = map;
	this.line = line;
	this.contents = '';
	this.logger = opts.logger.child({component: 'BundleManifest', bundle: bundle.name});
	this.log = this.logger.debug.bind(this.logger);
}

var proto = BundleManifest.prototype;

proto.insert = function (entry) {
	var bundler, manifest, src, map, mapSource, modules, section, alias, own;
	manifest = this;
	bundler = this.bundler;
	modules = this.modules;
	section = {};
	own = this.bundle;
	map = this.map;
	src = MODULE_START + entry.contents + MODULE_BODY_END;
	if (this.log()) this.log({module: entry.relName}, 'inserting module into manifest');
	if (map) {
		if (this.log()) this.log({module: entry.relName}, 'adding sourcemap entry at line %d', this.line);
		mapSource = path.relative(this.package, entry.main || entry.fullpath);
		map.addFile({
			sourceFile: mapSource,
			source: entry.contents
		}, {line: this.line});
	}
	entry.dependencies.forEach(function (fauxdep) {
		var bundle, dep;
		dep = bundler.getModuleFromName(fauxdep.name);
		bundle = bundler.getBundleForModule(dep);
		// if the bundle is not the same as the bundle we are building a manifest for then
		// we do not need to add an alias entry unless it is a request
		if (fauxdep.alias != dep.name) {
			// if they are the same then we need to ensure that the non-unique relative path
			// used in the require/request will be properly mapped
			if (!alias) alias = {};
			alias[fauxdep.alias] = dep.relName;
		}
		// if they are different and the bundle is a requested bundle then we need to map the
		// dependent module to the bundle that contains it so the request functionality can
		// correctly resolve it
		if (bundle.name != own.name && bundle.request) {
			manifest.insertRequestMap(dep, bundle);
		}
	});
	if (alias) src += this.getAliasMap(alias);
	src += MODULE_END;

	// create the ordered entry for the manifest
	section.name = entry.relName;
	section.value = src;
	modules.push(section);
	this.updateLines(src);
};

proto.insertRequestMap = function (entry, bundle) {
	var requests, bundles;
	requests = this.requests;
	bundles = this.bundles;
	if (requests.indexOf(entry.name) === -1) requests.push(entry.name);
	if (this.log()) this.log('adding request mapping entry from module %s to bundle %s', entry.relName, bundle);
	if (bundles.indexOf(bundle.name) === -1) bundles.push(bundle.name);
	this.addHardDependenciesFor(bundle);
};

proto.addHardDependenciesFor = function (bundle) {
	var manifest, bundles;
	manifest = this;
	bundles = this.bundles;
	if (typeof bundle == 'string') bundle = this.bundler.getBundleFromName(bundle);
	if (bundle.hardDependencies && bundle.hardDependencies.length) {
		bundle.hardDependencies.forEach(function (name) {
			if (bundles.indexOf(name) === -1) bundles.push(name);
			manifest.addHardDependenciesFor(name);
		});
	}
};

proto.getAliasMap = function (map) {
	var src, lines;
	src = MODULE_MAP_START;
	lines = [];
	Object.keys(map).forEach(function (key) {
		// stupid editor won't properly highlight after escaping single quotes in single quotes...
		lines.push(util.format("'%s':'%s'", key, map[key]));
	});
	src += lines.join(',');
	src += MODULE_MAP_END;
	return src;
};

proto.updateLines = function (str) {
	if (this.map) {
		var n = this.line;
		this.line += this.numberOfLines(str);
		if (this.log()) this.log('updating line count from %d to %d', n, this.line);
	}
};

proto.numberOfLines = function (str) {
	var lines = str && typeof str == 'string' && str.split(/\r\n|\r|\n/);
	return Math.max(lines.length - 1, 0);
};

proto.compile = function () {
	var bundler, modules, requests, bundles, opts, src;
	opts = this.options;
	bundler = this.bundler;
	modules = this.modules;
	requests = this.requests;
	bundles = this.bundles;
	if (this.log()) this.log('compiling manifest source for %d module entries', modules.length + requests.length);
	src = MANIFEST_START;
	src += modules.map(function (section) {
		// stupid editor won't properly highlight after escaping single quotes in single quotes
		// ...
		return util.format("'%s':%s", section.name, section.value);
	}).join(',');
	if (requests.length) {
		src += ',';
		if (this.log()) this.log('adding %d external request references', requests.length);
		src += requests.map(function (name) {
			var entry = bundler.getModuleFromName(name);
			// stupid editor won't properly highlight after escaping single quotes in single
			// quotes...
			return util.format("'%s':'%s'", entry.relName, entry.bundleName);
		}).join(',');
	}
	if (bundles.length) {
		src += ',';
		if (this.log()) this.log('adding %d external bundle references', bundles.length);
		src += bundles.map(function (name) {
			var bundle, entry;
			bundle = bundler.getBundleFromName(name);
			// stupid editor won't properly highlight after escaping single quotes in single
			// quotes...
			entry = util.format("'%s':{source:'%s'", bundle.name, util.format('%s.js', bundle.name));
			if (bundle.style && (opts.devMode || bundle.request)) {
				entry += util.format(',style:\'%s\'', util.format('%s.css', bundle.name));
			}
			if (bundle.hardDependencies && bundle.hardDependencies.length) {
				entry += util.format(",dependencies:['%s']", bundle.hardDependencies.join("','"));
			}
			entry += '}';
			return entry;
		}).join(',');
	}
	src += MANIFEST_END;
	if (this.log()) this.log('done compiling manifest, %d characters', src.length);
	this.contents = src;
	return src;
};