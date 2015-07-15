'use strict';

var
	opts = require('../../../Server/options');

opts.package.position = 1;

module.exports = {
	name: 'serve',
	help: 'Executes an HTTP server capabale of automatically rebuilding a ' +
		'project\'s source when changes occur. With watch set to false, is a simple web-server.',
	options: opts,
	callback: function (opts) {
		require('../../../../').serve(opts);
	}
};