'use strict';

var
	path = require('path'),
	fs = require('fs'),
	util = require('util');

var
	EventEmitter = require('events').EventEmitter,
	Promise = require('promise');

var
	clone = require('clone'),
	defined = require('defined'),
	bower = require('bower');


var
	logger = require('../logger');





function Generator (opts) {
	if (!(this instanceof Generator)) return new Generator(opts);
	
	this.options = opts = clone(opts);
	this.package = opts.package = path.resolve(opts.package);
	
	logger.setLogLevel(opts.logLevel);
	
	this.initPackageDirectory();
	
	if (opts.init) {
		this.init();
	} else {
		
	}
}



module.exports = Generator;


util.inherits(Generator, EventEmitter);



Generator.prototype.initPackageDirectory = function () {
	
	logger.log('debug', 'initializing target package directory %s', this.package);
	
	var
		dir;
	
	try {
		
		dir = fs.lstatSync(this.package);
		
	} catch (e) {
	
		logger.log('debug', 'package directory did not exist, creating it');
		
		// @todo Do we need to set the mode here or is 0777 ok?
		// if either of these fail then we want the error to be uncaught for now
		fs.makedirSync(this.package);
		dir = fs.lstatSync(this.package);
	}
	
	if (!dir.isDirectory()) {
		throw new Error(
			'Error: the target package location exists but is not a directory'
		);
	}
};



Generator.prototype.init = function () {
	
	var
		rcPath = path.join(this.package, '.bowerrc'),
		tpl = require('./bowerrc.json'),
		rc;
	
	logger.log('info', 'initializing %s', this.package);
	
	// test to see if a .bowerrc file already exists because we will need to do some updates
	// if so instead of just blindly overwriting it
	try {
		rc = fs.readFileSync(rcPath, 'utf8');
	} catch (e) {}
	
	if (rc) {
		// alright, one already existed...
		logger.log('debug', 'found existing .bowerrc file in package');
		rc = JSON.parse(rc);
		Object.keys(tpl).forEach(function (key) {
			rc[key] = defined(rc[key], tpl[key]);
		});
	} else {
		// nope get to start fresh
		rc = tpl;
	}
	
	logger.log('debug', 'writing .bowerrc file to package location');
	fs.writeFileSync(path.join(this.package, '.bowerrc'), JSON.stringify(rc, null, 2));
	
	this.installBowerDeps();
};