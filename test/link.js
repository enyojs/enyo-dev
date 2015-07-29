'use strict';

var
	link = require('../lib/enyo/lib/link'),
	init = require('../lib/enyo/lib/init');

describe('enyo link', function () {
	
	context('Clean environment', function () {
		
		var opts;
		
		before(function () {
			return resetEnv().then(function () {
				return getOpts({cwd: testEmpty}).then(function (o) {
					opts = o;
				});
			});
		});
		
		it('should throw an error if no project-level configuration exists and linking project', function () {
			return link(opts).should.eventually.be.rejected;
		});
		
		it('should throw an error if no project-level configuration exists and linking into project', function () {
			var lopts = {env: opts.env, target: 'enyo'};
			return link(opts).should.eventually.be.rejected;
		});
		
	});
	
	context('Project environment', function () {
	
		var opts;
		
		before(function () {
			return resetEnv().then(function () {
				return getOpts({cwd: testProj}).then(function (o) {
					opts = o;
				});
			});
		});
	
		it('should be able to make the current project linkable', function () {
			return link(opts).then(function () {
				return fs.lstatAsync(path.join(opts.env.userLinks, opts.env.config.get('name'))).then(function (stat) {
					return stat.isSymbolicLink();
				});
			}).should.eventually.be.true;
		});
		
		it('should be able to link another linkable project into the current project', function () {
			return getOpts({cwd: testLink, target: 'testproject', dependencies: false}).then(function (topts) {
				return init(topts).then(function () {
					return link(topts).then(function () {
						return fs.lstatAsync(path.join(topts.env.cwd, 'lib', topts.target)).then(function (stat) {
							return stat.isSymbolicLink();
						});
					});
				});
			}).should.eventually.be.true;
		});
		
		it('should correctly resolve the current "libDir" value from the configuration', function () {
			return getOpts({cwd: testLink, target: 'testproject', dependencies: false}).then(function (topts) {
				topts.env.config.json.libDir = 'newlibdir';
				return init(topts).then(function () {
					return link(topts).then(function () {
						return fs.lstatAsync(path.join(topts.env.cwd, 'newlibdir', topts.target)).then(function (stat) {
							return stat.isSymbolicLink();
						});
					}).should.eventually.be.true;
				});
			});
		});
		
		it('should throw an error if directory already exists', function () {
			return fs.ensureDirAsync(path.join(testLink, 'testlibdir', 'testproject')).then(function () {
				return getOpts({cwd: testLink, target: 'testproject', libDir: 'testlibdir'}).then(function (topts) {
					return link(topts).should.eventually.be.rejected;
				});
			});
		});
		
		it('should throw an error if the link already exists', function () {
			return getOpts({cwd: testLink, target: 'testproject', dependencies: false}).then(function (topts) {
				return init(topts).then(function () {
					return link(topts).should.eventually.be.rejected;
				});
			});
		});
		
		it('should correctly create the link if the --force flag is set', function () {
			return getOpts({cwd: testLink, target: 'testproject', dependencies: false, libDir: 'testlibdir', force: true}).then(function (topts) {
				return init(topts).then(function () {
					return link(topts).then(function () {
						return fs.lstatAsync(path.join(testLink, 'testlibdir', 'testproject')).then(function (stat) {
							return stat.isSymbolicLink();
						});
					}).should.eventually.be.true;
				});
			});
		});
		
		it('should be able to link multiple libraries simultaneously', function () {
			return setupLinks().then(function () {
				return getOpts({env: opts.env, target: 'test1,test2,test3'}).then(function (opts) {
					return link(opts).then(function () {
						return opts.env.get('libDir').then(function (libDir) {
							return all([
								fs.lstatAsync(path.join(testProj, libDir, 'test1')).then(function (stat) {
									return stat.isSymbolicLink();
								}).should.eventually.be.true,
								fs.lstatAsync(path.join(testProj, libDir, 'test2')).then(function (stat) {
									return stat.isSymbolicLink();
								}).should.eventually.be.true,
								fs.lstatAsync(path.join(testProj, libDir, 'test3')).then(function (stat) {
									return stat.isSymbolicLink();
								}).should.eventually.be.true
							]);
						});
					});
				});
			});
		});
		
		it('should save the target(s) to the current configuration in projects with --save set', function () {
			return resetEnv().then(function () {
				return setupLinks();
			}).then(function () {
				return getOpts({cwd: testProj, target: 'test1,test2', save: true}).then(function (opts) {
					return link(opts).then(function () {
						return resolve(opts.env.config.get('links')).should.eventually.be.an('array').and.contain('test1', 'test2');
					});
				});
			});
		});
		
		it('should list the current project\'s linked libraries with --list', function () {
			return resetEnv().then(function () {
				return setupLinks();
			}).then(function () {
				return getOpts({cwd: testProj, target: 'test1,test2'}).then(function (opts) {
					return link(opts);
				});
			}).then(function () {
				return getOpts({cwd: testProj, list: true}).then(function (opts) {
					return link(opts);
				}).then(function (links) {
					return resolve(links.map(function (e) { return e.name; })).should.eventually.be.an('array').with.length(2).and.contain('test1','test2');
				});
			});
		});
		
		it('should list the known linkable libraries if not in a project with --list', function () {
			return resetEnv().then(function () {
				return setupLinks();
			}).then(function () {
				return getOpts({cwd: testHome, list: true});
			}).then(function (opts) {
				return link(opts).then(function (links) {
					return links.map(function (e) { return e.name; });
				});
			}).then(function (links) {
				return resolve(links).should.eventually.be.an('array').with.length(3).and.contain('test1','test2','test3');
			});
		});
		
		it('should list the known linkable libraries with --list-linkable', function () {
			return resetEnv().then(function () {
				return setupLinks();
			}).then(function () {
				return getOpts({cwd: testProj, listLinkable: true});
			}).then(function (opts) {
				return link(opts).then(function (links) {
					return links.map(function (e) { return e.name; });
				});
			}).then(function (links) {
				return resolve(links).should.eventually.be.an('array').with.length(3).and.contain('test1','test2','test3');
			});
		});
	});
	
	
});