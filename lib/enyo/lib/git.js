'use strict';

var
	fs = require('fs-extra'),
	path = require('path'),
	util = require('util'),
	os = require('os');

var
	Git = require('nodegit'),
	Repository = Git.Repository,
	Clone = Git.Clone,
	Checkout = Git.Checkout,
	Commit = Git.Commit;

var
	open = Repository.open,
	clone = Clone.clone;

var
	cli = require('../../cli-logger'),
	utils = require('../../utils');

function getTreeish (repo, target) {
	return new Promise(function (resolve, reject) {
		repo.getReference(target)
			.then(resolve, function () {
				return repo.getReference('origin/' + target);
			})
			.then(resolve, function () {
				return repo.getCommit(target);
			})
			.then(resolve, reject);
	});
}

module.exports = manageLibrary;

function manageLibrary (libDir, lib, opts, done) {
	
	var
		libLoc = path.join(libDir, lib),
		libCache = path.join(opts._configDir, 'repos', lib),
		sources = opts.getValue('sources'),
		src, uri, target, msg;
	
	if (!sources) {
		msg = util.format(
			'no sources were available from the current configuration, ensure you have entries in ' +
			'your "sources" object mapping library names to their remote git repositories'
		);
		cli(msg);
		return done(new Error(msg));
	}
	
	if (!(uri = sources[lib])) {
		msg = util.format(
			'no source entry found for %s from the configuration, ensure you have an entry in your ' +
			'"sources" object mapping %s to its remote git repository',
			lib,
			lib
		);
		cli(msg);
		return done(new Error(msg));
	}
	
	src = utils.parseGitUri(uri);
	target = src.target;
	uri = utils.buildGitUri(src);
	
	fs.stat(libLoc, function (err, stat) {
		if (err) {
			fs.stat(libCache, function (err) {
				if (err) {
					cloneLibrary(lib, uri, opts, function (err) {
						if (err) {
							cli(err.toString());
							done(err);
						} else {
							copyLibrary(libCache, libDir, lib, opts, function (err) {
								if (!err) checkoutLibrary(libDir, lib, target, opts, function (err) {
									if (err) {
										cli(err.toString());
										done(err);
									} else {
										done();
									}
								});
								
								else {
									cli(err.toString());
									done(err);
								}
							});
						}
					});
				} else {
					updateLibrary(libCache, lib, opts, function (err) {
						if (err) cli('unable to update %s -> \n\t%s', lib, err.toString());
						copyLibrary(libCache, libDir, lib, opts, function (err) {
							if (!err) checkoutLibrary(libDir, lib, target, opts, function (err) {
								if (err) {
									cli(err.toString());
									done(err);
								} else {
									done();
								}
							});
						
							else {
								cli(err.toString());
								done(err);
							}
						});
					});
				}
			});
		} else if (stat.isDirectory()) {
			updateLibrary(libLoc, lib, opts, function (err) {
				if (err) cli('unable to update %s -> \n\t\%s', lib, err.toString());
				checkoutLibrary(libDir, lib, target, opts, function (err) {
					if (err) {
						cli(err.toString());
						done(err);
					} else done();
				});
			});
		} else {
			msg = util.format(
				'%s exists in the project at %s but is not a directory or git repository',
				lib,
				libLoc
			);
			cli(msg);
			done(new Error(msg));
		}
	});
}

function cloneLibrary (lib, uri, opts, done) {
	
	var
		libCache = path.join(opts._configDir, 'repos', lib),
		cfg = {}, msg;

	if (os.platform() == 'darwin') {
		cfg.remoteCallbacks = {
			certificateCheck: function () { return 1; }
		};
	}
	
	fs.ensureDir(libCache, function (err) {
		if (!err) {
			cli('cloning %s from %s', lib, uri);
			clone(uri, libCache, cfg)
				.then(function () { done(); })
				.catch(function (err) { done(new Error(err)); });
		} else {
			msg = util.format(
				'failed to create or read from the repository cache for %s -> \n\t%s',
				lib,
				err.toString()
			);
			done(new Error(msg));
		}
	});
	
}

function copyLibrary (libCache, libDir, lib, opts, done) {
	
	var
		libLoc = path.join(libDir, lib),
		msg = util.format(
			'failed to copy library %s from %s to %s -> \n\t%s',
			lib,
			libCache,
			libLoc
		);
	
	fs.ensureDir(libLoc, function (err) {
		if (!err) {
			fs.copy(libCache, libLoc, function (err) {
				if (err) done(new Error(util.format(msg, err.toString())));
				else done();
			});
		} else done(new Error(util.format(msg, err.toString())));
	});
	
}

function updateLibrary (libLoc, lib, opts, done) {
	
	var repo;
	
	open(libLoc)
		.then(function (_repo) {
			repo = _repo;
			return repo.fetchAll({
				credentials: function (url, userName) {
					return Git.Cred.sshKeyFromAgent(userName);
				},
				certificateCheck: function () { return 1; }
			});
		})
		.then(function () {
			done();
		})
		.catch(function (err) {
			var msg = util.format(
				'failed to update the library %s -> \n\t%s',
				lib,
				err.toString()
			);
			done(new Error(msg));
		});
}

function checkoutLibrary (libDir, lib, target, opts, done) {
	
	var
		cfg = {checkoutStrategy: Git.Checkout.STRATEGY.FORCE},
		libLoc = path.join(libDir, lib),
		repo, msg, ref, commit;
	
	open(libLoc)
		.then(function (_repo) {
			repo = _repo;
			return getTreeish(repo, target);
		})
		.then(function (treeish) {
			if (treeish instanceof Commit) return treeish;
			else {
				ref = treeish;
				return repo.getCommit(ref.target());
			}
		})
		.then(function (_commit) {
			commit = _commit;
		})
		.then(function () {
			if (ref) {
				return repo.setHead(ref.name(), repo.defaultSignature(), '')
					.then(function () {
						return Checkout.head(repo, cfg);
					})
					.then(function () {
						return Checkout.tree(repo, commit, cfg);
					})
					.done(function () {
						cli('checked out %s (%s) for %s', target, ref.target(), lib);
						done();
					});
			} else {
				return Checkout.tree(repo, commit, cfg)
					.then(function () {
						return repo.setHeadDetached(commit.id(), repo.defaultSignature(), '');
					})
					.done(function () {
						cli('checked out %s in detched state for %s', commit.id(), lib);
						done();
					});
			}
		})
		.catch(function (err) {
			msg = util.format(
				'unable to correctly checkout repository %s (%s) at %s -> \n\t%s',
				lib,
				libLoc,
				target,
				err
			);
			done(new Error(msg));
		});
}