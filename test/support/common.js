'use strict';

var
	path = require('path'),
	os = require('os');

var
	Promise = require('bluebird');

global.Promise = Promise;

var
	chai = require('chai'),
	chaiAsPromised = require('chai-as-promised'),
	merge = require('merge');

chai.should();
chai.use(chaiAsPromised);

global.expect = chai.expect;
global.all = Promise.all;
global.reject = Promise.reject;
global.resolve = Promise.resolve;
global.fs = Promise.promisifyAll(require('fs-extra'));
global.path = path;

// so that the env module uses the correct location
global.testHome = path.join(os.tmpdir(), 'enyo-dev');
global.testProj = path.join(testHome, 'proj');
global.testEmpty = path.join(testHome, 'empty');

var
	env = require('../../lib/enyo/lib/env'),
	cli = require('../../lib/cli-logger');

// we don't want to see output during testing
cli.stop();

global.getOpts = function (addl) {
	var def = {cwd: testHome};
	if (addl) def = merge(def, addl);
	return env(def);
};

var projConf, projPkg;

projConf = {
	libraries: [
		'enyo',
		'moonstone'
	],
	libDir: 'libdir',
	sources: {
		enyo: 'git@github.com:enyojs/enyo.git',
		moonstone: 'https://github.com/enyojs/moonstone.git'
	}
};

projPkg = {
	name: 'testproject',
	paths: [
		'lib'
	]
};

global.setupEnv = function () {
	return fs.ensureDirAsync(testHome).then(function () {
		return all([
			fs.ensureDirAsync(testEmpty),
			fs.ensureDirAsync(testProj).then(function () {
				return all([
					fs.writeJsonAsync(path.join(testProj, '.enyoconfig'), projConf, {spaces: 2}),
					fs.writeJsonAsync(path.join(testProj, 'package.json'), projPkg, {spaces: 2})
				])
			})
		])
	});
};

global.cleanupEnv = function () {
	return fs.removeAsync(testHome);
};

global.resetEnv = function () {
	return fs.emptyDirAsync(testHome).then(function () {
		return setupEnv();
	});
};