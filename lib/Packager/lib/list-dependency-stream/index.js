'use strict';

var
	util = require('util'),
	path = require('path');

var
	Transform = require('stream').Transform;

var
	archy = require('archy'),
	chalk = require('chalk');


module.exports = ListDependencyStream;

function ListDependencyStream (opts) {
	if (!(this instanceof ListDependencyStream)) return new ListDependencyStream(opts);
	
	opts = opts || {};
	this.options = opts;
	
	Transform.call(this, {objectMode: true});
	
	this._bundles = {};
	this._modules = {};
}

util.inherits(ListDependencyStream, Transform);

ListDependencyStream.prototype._transform = function (bundle, nil, next) {
	
	this._bundles[bundle.name] = bundle;
	for (var nom in bundle.modules) this._modules[nom] = bundle.modules[nom];
	next();
	
};

ListDependencyStream.prototype._flush = function (done) {
	
	var
		bundles = this._bundles,
		base = {label: 'bundles', nodes: []};
	
	for (var nom in bundles) {
		base.nodes.push(this.render(bundles[nom]));
	}
	
	this.push(archy(base));
	this.push(null);
	done();
};

ListDependencyStream.prototype.render = function (bundle, level) {
	
	var
		stream = this,
		ret = {},
		opts = this.options;
		ret.label = chalk.yellow(bundle.name) + '@' + (path.relative(opts.cwd, bundle.fullpath) || path.basename(bundle.fullpath));
	if (bundle.request) ret.label = chalk.red('*') + ret.label;
	if (bundle.hard_dependencies) ret.label += chalk.red(' ⤆ ' + bundle.hard_dependencies.join(', '));
	if (Array.isArray(bundle.dependents) && bundle.dependents.length) ret.label += chalk.green(' ⤇ ' + bundle.dependents.join(', '));
	ret.nodes = bundle.order.map(function (nom) {
		var
			m = bundle.modules[nom],
			n = chalk.blue((nom.charAt(0) == '/' ? path.relative(opts.cwd, nom) : nom) || path.basename(nom));
		if (m.isPackage) n += ' (' + path.relative(opts.cwd, m.main) + ')';
		if (m.dependencies.length) return stream.renderDependencies(m, n);
		else return n;
	});
	return ret;
};

ListDependencyStream.prototype.renderDependencies = function (mod, label) {
	var
		ret = {},
		opts = this.options,
		modules = this._modules,
		bundles = this._bundles;
	
	ret.label = label;
	ret.nodes = mod.dependencies.map(function (req) {
		
		var
			entry = modules[req.name],
			bundle, n;
		
		if (entry) {
			bundle = bundles[entry.bundleName],
			n = chalk.blue(' ⤆ ' + (entry.external ? entry.name : path.relative(opts.cwd, entry.name)));
		
			if (entry.bundleName != mod.bundleName) {
				n += chalk.blue(' (');
				if (req.request) n += chalk.red('*');
				if (bundle.request && !req.request) n += chalk.blue.bgRed(entry.bundleName);
				else if (req.request && !bundle.request) n += chalk.red.underline(entry.bundleName);
				else n += chalk.blue(entry.bundleName);
				n += chalk.blue(')');
			}
		} else {
			n = chalk.red(req.name);
		}
		
		return n;
	});
	
	return ret;
};