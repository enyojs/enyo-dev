'use strict';

var
	path = require('path');

var
	logger = require('../logger');

/**
* This module is used to produce a contextualized Browserify plugin that allows us to captcure
* any of the modules that are included and store their package.json information for later
* processing of special properties.
*/
module.exports = function (packager) {
	return function (bundle, opts) {
		bundle.on('package', function (pkg) {
			
			// for various reasons, mostly human readability when debugging we relative-ize the
			// path so we don't need to keep doing it on the fly (it doesn't need to be full path)
			// the last default is only for the package itself as it would be an empty string
			pkg.__dirname = path.relative(packager.package, pkg.__dirname) || './';
			
			logger.log('debug', 'package encountered "%s"', pkg.__dirname);
			packager.addPackage(pkg);
		});
	};
};