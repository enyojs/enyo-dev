'use strict';

var
	fs = require('fs-extra'),
	path = require('path'),
	util = require('util');

var
	cli = require('../../cli-logger');

module.exports = function (link, un, done) {
	
	if (typeof un == 'function') {
		done = un;
		un = false;
	}
	
	fs.lstat(link.destpath, function (err, stat) {
		if (un) {
			if (!err && stat.isSymbolicLink()) {
				fs.unlink(link.destpath, done);
			} else done(err);
		} else {
			if (err || (stat && stat.isSymbolicLink())) {
				if (stat && stat.isSymbolicLink()) {
					fs.unlink(link.destpath, function (err) {
						if (err) done(err);
						else {
							fs.symlink(link.fullpath, link.destpath, 'junction', done);
						}
					});
				} else fs.symlink(link.fullpath, link.destpath, 'junction', done);
			} else if (!stat.isSymbolicLink()) {
				done(new Error(util.format('Cannot link over existing file or directory %s', link.destpath)));
			}
		}
	});
};