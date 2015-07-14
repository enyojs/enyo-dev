'use strict';

var
	fs = require('fs'),
	path = require('path'),
	util = require ('util');

var
	Promise = require('bluebird');

var
	git = require('gift');

var
	lstat = Promise.promisify(fs.lstat);





function initialize (libDir, lib, opts) {
	
}