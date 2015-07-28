'use strict';

var
	unlink = require('../lib/enyo/lib/unlink'),
	link = require('../lib/enyo/lib/link');

describe('enyo unlink', function () {

	before(function () {
		return resetEnv().then(function () {
			return setupLinks();
		});
	});
	
	it('should throw an error if no target is specified without --unlink-all', function () {
		return getOpts({cwd: testProj}).then(function (opts) {
			return unlink(opts).should.eventually.be.rejected;
		});
	});
	
	it('should throw an error if --global set without --unlink-all and no target', function () {
		return getOpts({cwd: testProj, global: true}).then(function (opts) {
			return unlink(opts).should.eventually.be.rejected;
		});
	});
	
	it('should unlink the target library from a project', function () {
		return getOpts({cwd: testProj, target: 'test1'}).then(function (opts) {
			return link(opts);
		}).then(function () {
			return getOpts({cwd: testProj, target: 'test1'}).then(function (opts) {
				return unlink(opts).then(function () {
					return opts.env.get('libDir').then(function (libDir) {
						return fs.lstatAsync(path.join(opts.env.cwd, libDir, 'test1')).should.eventually.be.rejected;
					});
				});
			});
		});
	});
	
	it('should unlink all linked libraries in a project with --unlink-all', function () {
		return getOpts({cwd: testProj, target: 'test1,test2'}).then(function (opts) {
			return link(opts);
		}).then(function () {
			return getOpts({cwd: testProj, unlinkAll: true}).then(function (opts) {
				return unlink(opts).then(function () {
					return opts.env.get('libDir').then(function (libDir) {
						return all([
							fs.lstatAsync(path.join(opts.env.cwd, libDir, 'test1')).should.eventually.be.rejected,
							fs.lstatAsync(path.join(opts.env.cwd, libDir, 'test2')).should.eventually.be.rejected
						]);
					});
				});
			});
		});
	});
	
	it('should remove the target linkable library from the user\'s environment with --global and target', function () {
		return getOpts({global: true, target: 'test1'}).then(function (opts) {
			return unlink(opts).then(function () {
				return fs.lstatAsync(path.join(opts.env.userLinks, 'test1')).should.eventually.be.rejected;
			});
		});
	});
	
	it('should remove all linked libraries in the user\'s environment with --global and --unlink-all', function () {
		return getOpts({global: true, unlinkAll: true}).then(function (opts) {
			return unlink(opts).then(function () {
				return all([
					fs.lstatAsync(path.join(opts.env.userLinks, 'test2')).should.eventually.be.rejected,
					fs.lstatAsync(path.join(opts.env.userLinks, 'test3')).should.eventually.be.rejected
				]);
			});
		});
	});
	
	it('should save changes to projects with --save', function () {
		return resetEnv().then(function () {
			return setupLinks();
		}).then(function () {
			return getOpts({cwd: testProj, target: ['test1','test2','test3'], save: true}).then(function (opts) {
				return link(opts).then(function () {
					return all([
						resolve(opts.env.config.get('links')).should.eventually.be.an('array').and.contain('test1','test2','test3'),
						opts.env.get('libDir').then(function (libDir) {
							return all([
								fs.lstatAsync(path.join(opts.env.cwd, libDir, 'test1')).then(function (stat) {
									return stat.isSymbolicLink();
								}).should.eventually.be.true,
								fs.lstatAsync(path.join(opts.env.cwd, libDir, 'test2')).then(function (stat) {
									return stat.isSymbolicLink();
								}).should.eventually.be.true,
								fs.lstatAsync(path.join(opts.env.cwd, libDir, 'test3')).then(function (stat) {
									return stat.isSymbolicLink();
								}).should.eventually.be.true
							]);
						})
					]);
				});
			});
		}).then(function () {
			return getOpts({cwd: testProj, unlinkAll: true, save: true}).then(function (opts) {
				return unlink(opts).then(function () {
					return all([
						resolve(opts.env.config.get('links')).should.eventually.be.an('array').and.not.contain('test1','test2','test3'),
						opts.env.get('libDir').then(function (libDir) {
							return all([
								fs.lstatAsync(path.join(opts.env.cwd, libDir, 'test1')).should.eventually.be.rejected,
								fs.lstatAsync(path.join(opts.env.cwd, libDir, 'test2')).should.eventually.be.rejected,
								fs.lstatAsync(path.join(opts.env.cwd, libDir, 'test3')).should.eventually.be.rejected
							]);
						})
					]);
				});
			});
		});
	});

});