'use strict';

var
	fs = require('fs-extra'),
	path = require('path'),
	util = require('util');

var
	defined = require('defined'),
	clone = require('clone');

var
	cli = require('../../cli-logger'),
	setup = require('./setup'),
	config = require('./config').config,
	symlink = require('./symlink');

var exports = module.exports = function (opts) {
	setup(opts, exports.unlink);
};

exports.unlink = function (opts, done) {
	
	var
		libDir = opts.getPackageValue('libDir') || opts.getValue('libDir') || 'lib',
		target, fullpath, destpath, link, nom, save, cfg;

	if (!(target = opts.getValue('target'))) {
		if (!opts._packageFile || !opts._packageFile.name) {
			return cli(
				'Cannot unlink the current project without a package.json and a "name" by which ' +
				'the library/project can be referenced, even if the "name" is being overridden.'
			);
		}
		
		nom = defined(opts.getValue('as'), opts._packageFile.name);
		destpath = path.join(opts._linkDir, nom);
		fullpath = process.cwd();
		link = {name: nom, fullpath: fullpath};
		
		fs.lstat(destpath, function (err, stat) {
			if (err || !stat || !stat.isSymbolicLink()) {
				// couldn't find an entry based on a provided as value or the package name and we
				// can't assume they would want us to remove a custom named entry if there are
				// multiples...
				cli(
					'Unable to find a linked entry based on the provided information, is it missing ' +
					'an --as option?'
				);
				if (done) done();
			} else {
				link.destpath = destpath;
				symlink(link, true, function (err) {
					if (err) {
						cli('Unable to unlink %s (%s:%s) -> %s', link.name, link.fullpath, link.destpath, err.toString());
						if (done) done(false);
						return;
					}
					if (done) done(true);
				});
			}
		});
	} else {
		
		// unlike in the link case we always use target because they should always be using the
		// same name for the target as the one they used to link it, not a "real" name
		// (assuming they used --as when linking)
		nom = target;
		save = !! opts.getValue('save');
		destpath = path.join(process.cwd(), libDir, nom);
		link = {name: nom, destpath: destpath};
		
		fs.lstat(destpath, function (err, stat) {
			if (err || !stat.isSymbolicLink()) {
				cli('Could not find a linked entry for %s', nom);
				if (done) done(false);
				return;
			}
			
			fs.realpath(destpath, function (err, realpath) {
				if (err) {
					cli('Unable to determine the realpath of the local link, can still unlink most likely');
					link.fullpath = '[ unknown ]';
				} else link.fullpath = realpath;
				symlink(link, true, function (err) {
					if (err) {
						cli('Unable to unlink %s (%s:%s) -> %s', link.name, link.fullpath, link.destpath, err.toString());
						if (done) done(false);
						return;
					}
					if (save) {
						var sv = clone(opts, false);
						sv.global = false;
						sv.remove = true;
						sv.option = 'libraries';
						if (opts.configFile) {
							cfg = opts.getCustomValue('nameMap.' + target);
						} else cfg = opts.getLocalValue('nameMap.' + target);
						sv.value = defined(cfg, target);
						config(sv, function (success) {
							if (!success) {
								cli('Unable to remove saved entry for library %s', sv.value);
							}
							if (cfg != null) {
								delete sv.value;
								sv.option = 'nameMap.' + target;
								config(sv, function (success) {
									if (!success) {
										cli('Unable to remove saved nameMap entry for %s', target);
									}
									if (done) done(success);
									return;
								});
							} else if (done) done(success);
						});
					} else if (done) done(true);
				});	
			});
		});
	
	}
	
	
};