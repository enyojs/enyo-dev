'use strict';

var
	fs = require('fs'),
	path = require('path'),
	util = require('util');

var
	Promise = require('promise');

var
	lessc = require('less');

module.exports = function (files, opts) {
	return new Promise(function (resolve, reject) {
		
		var
			css = [],
			less = [];
			
		files.forEach(function (file) {

			var
				src = fs.readFileSync(file, 'utf8'),
				ext = path.extname(file),
				entry = {file: file};
			
			if (opts.preprocess) src = opts.preprocess(src, file);
			
			if (ext == '.less') {
				entry.token = util.format('/*%s*/', file);
				less.push(entry);
			}
			
			entry.src = src;
			
			css.push(entry);
		});
		
		compile(less, opts).then(function () {
			
			var
				compiled = '';
			
			css.forEach(function (entry) { compiled += entry.src + '\n'; });
			resolve(compiled);
		}, function (err) { reject(err); });
	});
};

function compile (files, opts) {
	return new Promise(function (resolve, reject) {
		
		if (!files.length) return resolve();
		
		var
			raw = '',
			cfg = {};
		
		files.forEach(function (entry) {
			raw += '\n' + entry.token;
			raw += entry.src;
			raw += entry.token + '\n';
		});
		
		if (opts.plugins) {
			cfg.plugins = opts.plugins.map(function (entry) {
				var plugin = require(entry.name);
				return new plugin(entry.options);
			});
		}
		
		lessc
			.render(raw, cfg)
			.then(function (compiled) {
				var css = compiled.css;
				files.forEach(function (entry) {
					var
						start = css.indexOf(entry.token) + entry.token.length + 1,
						end = css.lastIndexOf(entry.token);
					
					entry.src = css.slice(start, end);
				});
				resolve();
			}, function (err) { reject(err); });
		
	});
};