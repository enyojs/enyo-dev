'use strict';

var
	link = require('../lib/enyo/lib/link'),
	unlink = require('../lib/enyo/lib/unlink'),
	findLinks = require('../lib/enyo/lib/find-links');

describe('enyo find-links', function () {

	before(function () {
		return resetEnv().then(function () {
			return setupTestLibs();
		});
	});

	it('should throw an error if passed a non-directory', function () {
		var fp = path.join(testLibs, 'file');
		return fs.ensureFileAsync(fp).then(function () {
			return getOpts({cwd: testLibs, target: 'file'}).then(function (opts) {
				return findLinks(opts).should.eventually.be.rejected;
			});
		});
	});
	
	it('should throw an error if the path does not exist', function () {
		return getOpts({cwd: testLibs, target: 'DOESNOTEXIST'}).then(function (opts) {
			return findLinks(opts).should.eventually.be.rejected;
		});
	});
	
	it('should find and create links recursively from the current working directory', function () {
		return getOpts({global: true, unlinkAll: true}).then(function (opts) {
			return unlink(opts);
		}).then(function () {
			return getOpts({cwd: testLibs}).then(function (opts) {
				return findLinks(opts);
			});
		}).then(function () {
			return getOpts().then(function (opts) {
				return link.getLinkable(opts).then(function (libs) {
					return resolve(libs.map(function (e) { return e.name; })).should.eventually.be.an('array').and.contain('lib1','lib2','lib3');
				});
			});
		});
	});
	
	it('should find and create links recursively from the target directory', function () {
		return getOpts({global: true, unlinkAll: true}).then(function (opts) {
			return unlink(opts);
		}).then(function () {
			return getOpts({cwd: testProj, target: path.relative(testProj, testLibs)}).then(function (opts) {
				return findLinks(opts);
			});
		}).then(function () {
			return getOpts().then(function (opts) {
				return link.getLinkable(opts).then(function (libs) {
					return resolve(libs.map(function (e) { return e.name; })).should.eventually.be.an('array').and.contain('lib1','lib2','lib3');
				});
			});
		});
	});
	
});