'use strict';

var
	Packager = require('./lib/packager');

/**
* Package an Enyo 2.6+ application based on the provided options.
*/
exports.package = function (opts) {
	return new Packager(opts);
};