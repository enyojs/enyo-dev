'use strict';

var
	path = require('path');

var
	Promise = require('bluebird');

var
	fs = Promise.promisifyAll(require('fs-extra'));

module.exports = function (opts) {
	if (typeof opts == 'string') {
		return readdir(opts, {wip: false});
	} else {
		return readdir(opts.moduleDir, opts);
	}
};

function readdir (dir, opts) {
	return fs.readdirAsync(dir).map(function (file) {
		file = path.join(dir, file);
		return fs.statAsync(file).then(function (stat) {
			var pkg;
			if (stat.isFile() && path.extname(file) == '.js') {
				if (opts.wip || file.indexOf('wip') === -1) return file;
			} else if (stat.isDirectory()) {
				pkg = path.join(file, 'package.json');
				return fs.statAsync(pkg).then(function (stat) {
					if (stat.isFile()) {
						return fs.readJsonAsync(pkg).then(function (json) {
							if (opts.wip || !json.wip) {
								return readdir(file, opts).then(function (files) {
									files.unshift(file);
									return files;
								});
							}
						}); 
					} else return readdir(file, opts);
				}, function () {
					return readdir(file, opts);
				});
			};
		});
	}).reduce(function (c, n) {
		if (n) {
			if (typeof n == 'string') {
				c.push(n);
				return c;
			} else if (Array.isArray(n)) {
				return c.concat(n);
			}
		}
		return c;
	}, []);
}