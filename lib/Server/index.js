'use strict';

var
	express = require('express');

var
	logger = require('../logger'),
	dev = require('../../');



module.exports = function (opts) {
	
	var
		app = express(),
		server,
		addr = opts.localOnly ? '127.0.0.1' : '0.0.0.0';
	
	// @todo is this really the best way to do this?
	if (!opts.webRoot) opts.webRoot = opts.outdir;
	
	dev.package(opts).on('done', function () {
		
		app.use(express.static(opts.webRoot));
		
		server = app.listen(opts.port, addr, function () {
			var addr = server.address();
			logger.log('info', 'server is listening on %s:%s', addr.address, addr.port);
		});
	});
};