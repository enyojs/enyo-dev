'use strict';

var
	merge = require('merge'),
	clone = require('clone');

var
	init = require('../lib/enyo/lib/init');

describe('enyo init', function () {
	
	context('Clean project', function () {
		
		var opts;
		
		before(function () {
			return resetEnv().then(function () {
				return getOpts({cwd: testEmpty, dependencies: false}).then(function (o) {
					opts = o;
					return init(opts);
				});
			});
		});
		
		function startOver (lopts) {
			return fs.emptyDirAsync(testEmpty).then(function () {
				return getOpts(merge({dependencies: false, cwd: testEmpty}, lopts));
			});
		}
		
		it('should generate a .gitignore, .enyoconfig and package.json file', function () {
			return all([
				fs.statAsync(path.join(testEmpty, '.gitignore')).then(function (stat) {
					return stat.isFile();
				}).should.eventually.be.true,
				fs.statAsync(path.join(testEmpty, '.enyoconfig')).then(function (stat) {
					return stat.isFile();
				}).should.eventually.be.true,
				fs.statAsync(path.join(testEmpty, 'package.json')).then(function (stat) {
					return stat.isFile();
				}).should.eventually.be.true
			]);
		});
		
		it('should not generate a .gitignore if --no-gitignore is set', function () {
			return startOver({cwd: testEmpty, env: opts.env, gitIgnore: false}).then(function (opts) {
				return init(opts).then(function () {
					return fs.statAsync(path.join(testEmpty, '.gitignore')).should.eventually.be.rejected;
				});
			});
		});
		
		it('should not generate a .enyoconfig if --no-config is set', function () {
			return startOver({cwd: testEmpty, env: opts.env, config: false}).then(function (opts) {
				return init(opts).then(function () {
					return fs.statAsync(path.join(testEmpty, '.enyoconfig')).should.eventually.be.rejected;
				});
			});
		});
		
		it('should not generate a package.json if --no-package is set', function () {
			return startOver({cwd: testEmpty, env: opts.env, package: false}).then(function (opts) {
				return init(opts).then(function () {
					return fs.statAsync(path.join(testEmpty, 'package.json')).should.eventually.be.rejected;
				});
			});
		});
		
		it('should not update package.json if --no-package and options set', function () {
			return resetEnv().then(function () {
				return getOpts({cwd: testProj, package: false, name: 'NEWNAME', dependencies: false}).then(function (opts) {
					return init(opts).then(function () {
						return all([
							resolve(opts.env.config.get('name')).should.eventually.equal('NEWNAME'),
							resolve(opts.env.package.get('name')).should.eventually.not.equal('NEWNAME')
						]);
					});
				});
			});
		});
		
		it('should not update .enyoconfig if --no-config and options set', function () {
			return resetEnv().then(function () {
				return getOpts({cwd: testProj, config: false, name: 'NEWNAME', dependencies: false}).then(function (opts) {
					return init(opts).then(function () {
						return all([
							resolve(opts.env.config.get('name')).should.eventually.not.equal('NEWNAME'),
							resolve(opts.env.package.get('name')).should.eventually.equal('NEWNAME')
						]);
					});
				});
			});
		});
		
		it('should update the "name" value of .enyoconfig and package.json if set', function () {
			return resetEnv().then(function () {
				return getOpts({cwd: testProj, name: 'NEWNAME', dependencies: false}).then(function (opts) {
					return init(opts).then(function () {
						return all([
							resolve(opts.env.config.get('name')).should.eventually.equal('NEWNAME'),
							resolve(opts.env.package.get('name')).should.eventually.equal('NEWNAME')
						]);
					});
				});
			});
		});
		
		it('should update the "title" value of .enyoconfig if set', function () {
			return getOpts({cwd: testProj, title: 'NEW TITLE', dependencies: false}).then(function (opts) {
				return init(opts).then(function () {
					return resolve(opts.env.config.get('title')).should.eventually.equal('NEW TITLE');
				});
			});
		});
		
		it('should save --libraries, --links and --link-all-libs values if --save set', function () {
			return startOver({save: true, links: ['enyo'], libraries: ['enyo','moonstone'], linkAllLibs: true}).then(function (opts) {
				return init(opts).then(function () {
					return all([
						resolve(opts.env.config.get('libraries')).should.eventually.be.an('array').with.length(2),
						resolve(opts.env.config.get('links')).should.eventually.be.an('array').with.length(1),
						resolve(opts.env.config.get('linkAllLibs')).should.eventually.be.true
					]);
				});
			});
		});
		
		it('should have cloned all of the default libraries', function () {
			this.timeout(15000);
			return resetEnv().then(function () {
				return getOpts({cwd: testProj, libraries: ['enyo']}).then(function (opts) {
					return init(opts).then(function () {
						return opts.env.get('libDir').then(function (libDir) {
							return fs.statAsync(path.join(testProj, libDir, 'enyo')).then(function (stat) {
								return stat.isDirectory();
							}).should.eventually.be.true;
						});
					});
				});
			});
		});
		
		it('should create links for libraries set via "links"', function () {
			return setupLinks().then(function () {
				return startOver({links: ['test1', 'test2', 'test3'], libraries: ['test1', 'test2', 'test3'], dependencies: true}).then(function (opts) {
					return init(opts).then(function () {
						return opts.env.get('libDir').then(function (libDir) {
							return all([
								fs.lstatAsync(path.join(testEmpty, libDir, 'test1')).then(function (stat) {
									return stat.isSymbolicLink();
								}).should.eventually.be.true,
								fs.lstatAsync(path.join(testEmpty, libDir, 'test2')).then(function (stat) {
									return stat.isSymbolicLink();
								}).should.eventually.be.true,
								fs.lstatAsync(path.join(testEmpty, libDir, 'test3')).then(function (stat) {
									return stat.isSymbolicLink();
								}).should.eventually.be.true
							]);
						});
					});
				});
			});
		});
		
		it('should not overwrite directories for linked libraries if --safe is set', function () {
			return resetEnv().then(function () {
				return getOpts({cwd: testEmpty}).then(function (opts) {
					return opts.env.get('libDir').then(function (libDir) {
						return all([
							fs.ensureDirAsync(path.join(testEmpty, libDir, 'test1')),
							setupLinks()
						]).then(function () {
							return getOpts({env: opts.env, links: ['test1', 'test2'], safe: true, libraries: ['test1', 'test2']}).then(function (opts) {
								return init(opts).then(function () {
									return all([
										fs.lstatAsync(path.join(testEmpty, libDir, 'test1')).then(function (stat) {
											return stat.isDirectory();
										}).should.eventually.be.true,
										fs.lstatAsync(path.join(testEmpty, libDir, 'test2')).then(function (stat) {
											return stat.isSymbolicLink();
										}).should.eventually.be.true
									]);
								});
							});
						});
					});
				});
			});
		});
		
		it('should link all libs if --link-all-libs is set', function () {
			return resetEnv().then(function () {
				return setupLinks().then(function () {
					return startOver({libraries: ['test1', 'test2', 'test3'], dependencies: true, linkAllLibs: true}).then(function (opts) {
						return init(opts).then(function () {
							return opts.env.get('libDir').then(function (libDir) {
								return all([
									fs.lstatAsync(path.join(testEmpty, libDir, 'test1')).then(function (stat) {
										return stat.isSymbolicLink();
									}).should.eventually.be.true,
									fs.lstatAsync(path.join(testEmpty, libDir, 'test2')).then(function (stat) {
										return stat.isSymbolicLink();
									}).should.eventually.be.true,
									fs.lstatAsync(path.join(testEmpty, libDir, 'test3')).then(function (stat) {
										return stat.isSymbolicLink();
									}).should.eventually.be.true
								]);
							});
						});
					});
				});
			});
		});
		
		it('should not attempt to initialize dependencies if --no-dependencies is set', function () {
			return resetEnv().then(function () {
				return getOpts({cwd: testProj, dependencies: false}).then(function (opts) {
					return init(opts).then(function () {
						return opts.env.get('libDir').then(function (libDir) {
							return fs.statAsync(path.join(testProj, libDir)).should.eventually.be.rejected;
						});
					});
				});
			});
		});
		
		it('should apply library defaults --library is set', function () {
			return resetEnv().then(function () {
				return getOpts({cwd: testEmpty, library: true}).then(function (opts) {
					return init(opts).then(function () {
						var f = clone(opts.env.system.library, true);
						f.name = 'empty';
						return all([
							resolve(opts.env.config.json).should.eventually.deep.equal(f),
							opts.env.get('libDir').then(function (libDir) {
								return fs.statAsync(path.join(testEmpty, libDir)).should.eventually.be.rejected
							})
						]);
					});
				});
			});
		});
		
		it('should reset .enyoconfig if the --reset flag is set', function () {
			return resetEnv().then(function () {
				return getOpts({cwd: testProj, reset: true, dependencies: false}).then(function (opts) {
					return init(opts).then(function () {
						var f = clone(opts.env.user.defaults, true);
						f.name= 'testproject';
						f.title = 'testproject';
						return resolve(opts.env.config.json).should.eventually.deep.equal(f);
					});
				});
			});
		});
		
	});

});