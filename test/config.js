'use strict';

var config = require('../lib/enyo/lib/config');

describe('enyo config', function () {

	var opts;
	
	before('Resetting environment', function () {
		return resetEnv();
	});

	context('Clean environment', function () {
	
		context('--get', function () {
			
			before(function () {
				return getOpts({get: true}).then(function (o) {
					opts = o;
				});
			});
			
			it('should throw an error if the target does not exist', function () {
				opts.target = undefined;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should resolve defaults object without --global', function () {
				opts.target = 'defaults';
				opts.global = false;
				return config(opts).should.eventually.be.an('object');
			});
			
			it('should resolve defaults object with --global', function () {
				opts.target = 'defaults';
				opts.global = true;
				return config(opts).should.eventually.be.an('object');
			});
			
			it('should resolve requested defaults property without --global', function () {
				opts.target = 'defaults.libraries';
				opts.global = false;
				return config(opts).should.eventually.be.an('array');
			});
			
			it('should resolve requested defaults property with --global', function () {
				opts.target = 'defaults.libraries';
				opts.global = true;
				return config(opts).should.eventually.be.an('array');
			});
			
			it('should resolve the requested user-level configuration property', function () {
				opts.target = 'interactive';
				opts.global = false;
				return config(opts).should.eventually.be.true;
			});
			
		});
		
		context('--set', function () {
			
			before(function () {
				return getOpts({set: true}).then(function (o) {
					opts = o;
				});
			});
			
			after(function () {
				return resetEnv().then(function () {
					return getOpts().then(function (o) {
						opts = o;
					});
				});
			});
			
			it('should throw an error if the target does not exist', function () {
				opts.target = undefined;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should throw an error if the global flag is not set', function () {
				opts.target = 'libDir';
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should throw an error if the target is an object', function () {
				opts.target = 'sources';
				opts.global = true;
				opts.value = false;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should throw an error if path set past non-object', function () {
				opts.target = 'interactive.invalid';
				opts.value = true;
				opts.global = true;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should throw an error if array flagged but is not an array', function () {
				opts.target = 'defaults.sources';
				opts.value = 'invalid';
				opts.array = true;
				opts.global = true;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should throw an error if path set past array', function () {
				opts.target = 'defaults.libraries.invalid';
				opts.value = 'invalid';
				opts.global = true;
				opts.array = false;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should not need the --global flag when setting using defaults keyword', function () {
				opts.target = 'defaults.linkAllLibs';
				opts.value = true;
				opts.global = false;
				opts.array = false;
				return config(opts).should.eventually.be.fullfilled;
			});
			
			it('should be able to set a boolean', function () {
				opts.target = 'defaults.linkAllLibs';
				opts.array = false;
				opts.value = false;
				return config(opts).then(function () {
					return getOpts({get: true, target: 'defaults.linkAllLibs'}).then(function (opts) {
						return config(opts).should.eventually.be.false;
					});
				});
			});
			
			it('should be able to set a string', function () {
				opts.target = 'defaults.libDir';
				opts.value = 'LIBDIR';
				opts.array = false;
				return config(opts).then(function () {
					return getOpts({get: true, target: 'defaults.libDir'}).then(function (opts) {
						return config(opts).should.eventually.be.equal('LIBDIR');
					});
				});
			});
			
			it('should be able to set a value on an object', function () {
				opts.target = 'defaults.sources.enyo-fake';
				opts.value = 'ssh://fake-git-url.git';
				opts.global = false;
				opts.array = false;
				return config(opts).then(function () {
					return getOpts({get: true, target: 'defaults.sources.enyo-fake'}).then(function (opts) {
						return config(opts).should.eventually.be.equal('ssh://fake-git-url.git');
					});
				});
			});
			
			it('should be able to set a value on a new object', function () {
				opts.target = 'defaults.fake.object.path';
				opts.value = true;
				opts.global = false;
				opts.array = false;
				return config(opts).then(function () {
					return getOpts({get: true, target: 'defaults.fake.object.path'}).then(function (opts) {
						return config(opts).should.eventually.be.true;
					});
				});
			});
			
			it('should be able to add a value to an array without the --array flag', function () {
				opts.target = 'defaults.libraries';
				opts.value = 'enyo-fake1';
				opts.global = false;
				opts.array = false;
				return config(opts).then(function () {
					return getOpts({get: true, target: 'defaults.libraries'}).then(function (opts) {
						return config(opts).should.eventually.contain('enyo-fake1');
					});
				});
			});
			
			it('should be able to add a value to an array with the --array flag', function () {
				opts.target = 'defaults.libraries';
				opts.value = 'enyo-fake2';
				opts.global = false;
				opts.array = true;
				return config(opts).then(function () {
					return getOpts({get: true, target: 'defaults.libraries'}).then(function (opts) {
						return config(opts).should.eventually.contain('enyo-fake2');
					});
				});
			});
			
			it('should be able to add values to a new array', function () {
				opts.target = 'defaults.newArray';
				opts.array = true;
				opts.value = 'enyo-fake3';
				return config(opts).then(function () {
					return getOpts({get: true, target: 'defaults.newArray'}).then(function (opts) {
						return config(opts).should.eventually.be.an('array').and.contain('enyo-fake3');
					});
				});
			});
			
			it('should be able to add multiple entries to an array at once', function () {
				opts.target = 'defaults.libraries';
				opts.value = 'enyo-fake4,enyo-fake5,enyo-fake6';
				return config(opts).then(function () {
					return getOpts({get: true, target: 'defaults.libraries'}).then(function (opts) {
						return config(opts).should.eventually.be.an('array').and.contains('enyo-fake4', 'enyo-fake5', 'enyo-fake6');
					});
				});
			});
			
		});
		
		context('--reset', function () {
			
			var opts;
		
			before(function () {
				return resetEnv().then(function () {
					return getOpts({reset: true}).then(function (o) {
						opts = o;
					});
				});
			});
			
			it('should reset custom simple defaults to system values', function () {
				return getOpts({set: true, target: 'defaults.libDir', value: 'CUSTOM'}).then(function (opts) {
					return config(opts).then(function () {
						return getOpts({reset: true, target: 'defaults.libDir'}).then(function (opts) {
							return config(opts).then(function () {
								return resolve(opts.env.user.defaults.libDir).should.eventually.be.equal(
									opts.env.system.defaults.libDir
								);
							});
						});
					});
				});
			});
			
			it('should reset custom object defaults to system values', function () {
				return getOpts({set: true, target: 'defaults.sources', value: {some: 'prop'}}).then(function (opts) {
					return config(opts).then(function () {
						return getOpts({reset: true, target: 'defaults.sources'}).then(function (opts) {
							return config(opts).then(function () {
								return resolve(opts.env.user.defaults.sources).should.eventually.deep.equal(
									opts.env.system.defaults.sources
								);
							});
						});
					});
				});
			});

			it('should reset custom array defaults to system values', function () {
				return getOpts({set: true, target: 'defaults.libraries', value: []}).then(function (opts) {
					return config(opts).then(function () {
						return getOpts({reset: true, target: 'defaults.libraries'}).then(function (opts) {
							return config(opts).then(function () {
								return resolve(opts.env.user.defaults.libraries).should.eventually.deep.equal(
									opts.env.system.defaults.libraries
								);
							});
						});
					});
				});
			});
			
			it('should completely reset user defaults to system defaults', function () {
				return resetEnv().then(function () {
					return getOpts({reset: true, global: true}).then(function (opts) {
						opts.env.user.defaults.libraries = [];
						opts.env.user.defaults.sources = {};
						opts.env.user.defaults.libDir = undefined;
						opts.env.user.json.interactive = false;
						return config(opts).then(function () {
							return all([
								resolve(opts.env.user.defaults.libraries).should.eventually.deep.equal(
									opts.env.system.defaults.libraries
								),
								resolve(opts.env.user.defaults.sources).should.eventually.deep.equal(
									opts.env.system.defaults.sources
								),
								resolve(opts.env.user.defaults.libDir).should.eventually.deep.equal(
									opts.env.system.defaults.libDir
								),
								resolve(opts.env.user.json.interactive).should.eventually.deep.equal(
									opts.env.system.config.interactive
								)
							]);
						});
					});
				});
			});
		});
	
	});
	
	context('Project environment', function () {
		
		context('--get', function () {
			
			before(function () {
				return getOpts({get: true, cwd: testProj}).then(function (o) {
					opts = o;
				});
			});
			
			it('should throw an error if the target does not exist', function () {
				opts.target = undefined;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should resolve defaults object without --global', function () {
				opts.target = 'defaults';
				opts.global = false;
				return config(opts).should.eventually.be.an('object');
			});
			
			it('should resolve defaults object with --global', function () {
				opts.target = 'defaults';
				opts.global = true;
				return config(opts).should.eventually.be.an('object');
			});
			
			it('should resolve requested defaults property without --global', function () {
				opts.target = 'defaults.libraries';
				opts.global = false;
				return config(opts).should.eventually.be.an('array');
			});
			
			it('should resolve requested defaults property with --global', function () {
				opts.target = 'defaults.libraries';
				opts.global = true;
				return config(opts).should.eventually.be.an('array');
			});
			
			it('should resolve the local configuration value', function () {
				return all([
					getOpts({target: 'libDir', global: false, env: opts.env}).then(function (opts) {
						return config(opts).should.eventually.be.equal('libdir');
					}),
					getOpts({target: 'libraries', global: false, env: opts.env}).then(function (opts) {
						return config(opts).should.eventually.be.an('array').with.length(2);
					})
				]);
			});
		
			it('should still be able to resolve the user-level configuration value', function () {
				return all([
					getOpts({target: 'libDir', global: true, env: opts.env}).then(function (opts) {
						return config(opts).should.eventually.be.equal('lib');
					}),
					getOpts({target: 'libraries', global: true, env: opts.env}).then(function (opts) {
						return config(opts).should.eventually.be.an('array').with.length.above(2);
					})
				]);
			});
			
		});
		
		context('--set', function () {
		
			before(function () {
				return getOpts({set: true, cwd: testProj}).then(function (o) {
					opts = o;
				});
			});
			
			after(function () {
				return resetEnv().then(function () {
					return getOpts().then(function (o) {
						opts = o;
					});
				});
			});
			
			it('should throw an error if the target does not exist', function () {
				opts.target = undefined;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should throw an error if the target is an object', function () {
				opts.target = 'sources';
				opts.value = false;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should throw an error if path set past non-object', function () {
				opts.target = 'interactive.invalid';
				opts.value = true;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should throw an error if array flagged but is not an array', function () {
				opts.target = 'defaults.sources';
				opts.value = 'invalid';
				opts.array = true;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should throw an error if path set past array', function () {
				opts.target = 'defaults.libraries.invalid';
				opts.value = 'invalid';
				opts.array = false;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should not need the --global flag when setting using defaults keyword', function () {
				opts.target = 'defaults.linkAllLibs';
				opts.value = true;
				opts.global = false;
				opts.array = false;
				return config(opts).should.eventually.be.fullfilled;
			});
			
			it('should be able to set a boolean', function () {
				opts.target = 'linkAllLibs';
				opts.array = false;
				opts.value = false;
				return config(opts).then(function () {
					return getOpts({get: true, target: 'linkAllLibs', cwd: testProj}).then(function (opts) {
						return config(opts).should.eventually.be.false;
					});
				});
			});
			
			it('should be able to set a string', function () {
				opts.target = 'libDir';
				opts.value = 'LIBDIR';
				opts.array = false;
				return config(opts).then(function () {
					return getOpts({get: true, target: 'libDir', cwd: testProj}).then(function (opts) {
						return config(opts).should.eventually.be.equal('LIBDIR');
					});
				});
			});
			
			it('should be able to set a value on an object', function () {
				opts.target = 'sources.enyo-fake';
				opts.value = 'ssh://fake-git-url.git';
				opts.array = false;
				return config(opts).then(function () {
					return getOpts({get: true, target: 'sources.enyo-fake', cwd: testProj}).then(function (opts) {
						return config(opts).should.eventually.be.equal('ssh://fake-git-url.git');
					});
				});
			});
			
			it('should be able to set a value on a new object', function () {
				opts.target = 'fake.object.path';
				opts.value = true;
				opts.array = false;
				return config(opts).then(function () {
					return getOpts({get: true, target: 'fake.object.path', cwd: testProj}).then(function (opts) {
						return config(opts).should.eventually.be.true;
					});
				});
			});
			
			it('should be able to add a value to an array without the --array flag', function () {
				opts.target = 'libraries';
				opts.value = 'enyo-fake1';
				opts.array = false;
				return config(opts).then(function () {
					return getOpts({get: true, target: 'libraries', cwd: testProj}).then(function (opts) {
						return config(opts).should.eventually.contain('enyo-fake1');
					});
				});
			});
			
			it('should be able to add a value to an array with the --array flag', function () {
				opts.target = 'libraries';
				opts.value = 'enyo-fake2';
				opts.array = true;
				return config(opts).then(function () {
					return getOpts({get: true, target: 'libraries', cwd: testProj}).then(function (opts) {
						return config(opts).should.eventually.contain('enyo-fake2');
					});
				});
			});
			
			it('should be able to add values to a new array', function () {
				opts.target = 'newArray';
				opts.array = true;
				opts.value = 'enyo-fake3';
				return config(opts).then(function () {
					return getOpts({get: true, target: 'newArray', cwd: testProj}).then(function (opts) {
						return config(opts).should.eventually.be.an('array').and.contain('enyo-fake3');
					});
				});
			});
			
			it('should be able to add multiple entries to an array at once', function () {
				opts.target = 'libraries';
				opts.value = 'enyo-fake4,enyo-fake5,enyo-fake6';
				return config(opts).then(function () {
					return getOpts({get: true, target: 'libraries', cwd: testProj}).then(function (opts) {
						return config(opts).should.eventually.be.an('array').and.contains('enyo-fake4', 'enyo-fake5', 'enyo-fake6');
					});
				});
			});
			
			it('should be able to remove a property when value is undefined', function () {
				opts.target = 'libDir';
				opts.value = undefined;
				opts.array = false;
				return config(opts).then(function () {
					return resolve(opts.env.config.json.libDir).should.eventually.be.undefined;
				});
			});
		
		});
		
		context('--remove', function () {
			
			before(function () {
				return getOpts({remove: true, cwd: testProj}).then(function (o) {
					opts = o;
				});
			});
			
			it('should be able to remove a simple property', function () {
				opts.target = 'libDir';
				return config(opts).then(function () {
					return getOpts({get: true, cwd: testProj, target: 'libDir'}).then(function (opts) {
						// note that the env is set so that the user-level is 'libdir' instead so
						// that is why this is correct
						return config(opts).should.eventually.be.equal('lib');
					});
				});
			});
			
			it('should be able to completely remove an object', function () {
				opts.target = 'sources';
				return config(opts).then(function () {
					return resolve(opts.env.config.json.sources).should.eventually.be.undefined;
				});
			});
			
			it('should be able to completely remove an array', function () {
				opts.target = 'links';
				return config(opts).then(function () {
					return resolve(opts.env.config.json.links).should.eventually.be.undefined;
				});
			});
			
			it('should be able to remove an entry from an array', function () {
				opts.target = 'libraries';
				opts.value = 'enyo';
				return config(opts).then(function () {
					return getOpts({get: true, cwd: testProj, target: 'libraries'}).then(function (opts) {
						return config(opts).should.eventually.be.an('array').and.not.contain('enyo');
					});
				});
			});
			
			it('should be able to remove multiple entries from an array', function () {
				opts.target = 'defaults.libraries';
				opts.value = 'moonstone,enyo';
				return config(opts).then(function () {
					return getOpts({get: true, cwd: testProj, target: 'defaults.libraries'}).then(function (opts) {
						return config(opts).should.eventually.be.an('array').and.not.contain('enyo', 'moonstone');
					});
				});
			});
			
		});
		
		context('--reset', function () {
			
			before(function () {
				return resetEnv().then(function () {
					return getOpts({reset: true, cwd: testProj}).then(function (o) {
						opts = o;
					});
				});
			});
			
			it('should throw an error if the path is a non-default configuration property', function () {
				opts.target = 'fakeProp';
				opts.global = false;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should throw an error if the path is a non-default configuration property with --global set', function () {
				opts.target = 'fakeProp';
				opts.global = true;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should throw an error if the defaults path is a non-default configuration property', function () {
				opts.tarket = 'defaults.fakeProp';
				opts.global = false;
				return config(opts).should.eventually.be.rejected;
			});
			
			it('should reset a simple known default value', function () {
				opts.target = 'libDir';
				opts.global = false;
				return config(opts).then(function () {
					return getOpts({cwd: testProj, get: true, target: 'libDir'}).then(function (opts) {
						return config(opts).should.eventually.be.equal('lib');
					});
				});
			});
			
			it('should reset an array known default value', function () {
				opts.target = 'libraries';
				opts.global = false;
				return config(opts).then(function () {
					return getOpts({cwd: testProj, get: true, target: 'libraries'}).then(function (opts) {
						return config(opts).should.eventually.be.an('array').and.deep.equal(opts.env.user.defaults.libraries);
					});
				});
			});
			
			it('should reset an object known default value', function () {
				opts.target = 'sources';
				opts.global = false;
				return config(opts).then(function () {
					return getOpts({cwd: testProj, get: true, target: 'sources'}).then(function (opts) {
						return config(opts).should.eventually.deep.equal(opts.env.user.defaults.sources);
					});
				});
			});
			
			it('should reset the local configuration to user defaults', function () {
				opts.target = undefined;
				opts.global = false;
				opts.env.config.json.libraries = [];
				opts.env.config.json.sources = {};
				opts.env.config.json.libDir = undefined;
				return config(opts).then(function () {
					return all([
						resolve(opts.env.config.json.libraries).should.eventually.deep.equal(
							opts.env.user.defaults.libraries
						),
						resolve(opts.env.config.json.sources).should.eventually.deep.equal(
							opts.env.user.defaults.sources
						),
						resolve(opts.env.config.json.libDir).should.eventually.deep.equal(
							opts.env.user.defaults.libDir
						)
					]);
				});
			});
		});
		
	});

});