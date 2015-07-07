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

var exports = module.exports = function (opts, done) {
	setup(opts, function (opts) {
		exports.link(opts, done);
	});
};

exports.link = function (opts, done) {
	
	var
		libDir = opts.getPackageValue('libDir') || opts.getValue('libDir') || 'lib',
		target, fullpath, destpath, link, nom, save;
	
	if (!(target = opts.getValue('target'))) {
		if (!opts._packageFile || !opts._packageFile.name) {
			cli(
				'Cannot link the current project without a package.json and a "name" by which ' +
				'the library/project can be referenced, even if the "name" is being overridden.'
			);
			if (done) done(false);
			return;
		}
		
		nom = defined(opts.getValue('as'), opts._packageFile.name);
		link = {name: nom, fullpath: process.cwd(), destpath: path.join(opts._linkDir, nom)};
		
		symlink(link, function (err) {
			if (err) cli('Unable to link %s (%s:%s) -> %s', link.name, link.fullpath, link.destpath, err.toString());
			if (done) done(false);
		});
	} else {
		
		nom = defined(opts.getValue('as'), target);
		fullpath = path.join(opts._linkDir, target);
		destpath = path.join(process.cwd(), libDir, nom);
		link = {name: nom, fullpath: fullpath, destpath: destpath};
		save = !! opts.getValue('save');
		
		fs.ensureDir(path.dirname(link.destpath), function (err) {
			
			if (err) {
				cli('Could not create the destination directory for %s -> %s', nom, err.toString());
				if (done) done(false);
				return;
			}
			
			fs.lstat(fullpath, function (err, stat) {
				if (err || !stat.isSymbolicLink()) {
					cli('Could not find a linked entry for %s', target);
					if (done) done(false);
					return;
				}
			
				symlink(link, function (err) {
					if (err) {
						cli('Unable to link %s -> %s', link.name, err.toString());
						if (done) done(false);
						return;
					}
					if (save) {
						var sv = clone(opts, false);
						sv.global = false;
						sv.option = 'libraries';
						sv.value = nom;
						config(sv, function (success) {
							if (!success) {
								cli('Could not save the link to the configuration file.');
								if (done) done(false);
								return;
							} else {
								if (target != nom) {
									// we need to still create a map from the custom name back to
									// the real name
									sv.option = 'nameMap.' + nom;
									sv.value = target;
									config(sv, function (success) {
										if (!success) {
											cli('Could not add the mapping value from %s to %s', nom, target);
										}
										if (done) done(success);
										return;
									});
								} else {
									if (done) done(success);
								}
							}
						});
					} else if (done) done(true);
				});
			});
		});
	
	}
};