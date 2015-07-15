'use strict';

var
	opts = require('../../../Packager/options');

opts.package.position = 1;

module.exports = {
	name: 'pack',
	help: 'Build an Enyo 2.6 application and optionally watch for changes and automatically ' +
		'rebuild.',
	options: opts,
	callback: function (opts) {
		require('../../../../').package(opts);
	}
};