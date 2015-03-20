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
			
			// the first package reported by browserify if the project but this is antithetical to
			// the inclusion order for style dependency so we ignore it and automatically add it
			// at the end when processing packages
			if (pkg.__dirname == packager.package) return;
			
			logger.log('debug', 'package encountered "%s"', path.relative(packager.package, pkg.__dirname));
			packager.addPackage(pkg);
		});
	};
};