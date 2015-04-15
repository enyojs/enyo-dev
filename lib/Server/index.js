'use strict';

var
	express = require('express'),
	filewatcher = require('filewatcher'),
	path = require('path');

var
	logger = require('../logger'),
	dev = require('../../');

module.exports = function (opts) {
	
	var
		app = express(),
		server,
		addr = opts.localOnly ? '127.0.0.1' : '0.0.0.0',
		watcher = filewatcher({debounce: 10});
	
	// @todo is this really the best way to do this?
	if (!opts.webRoot) opts.webRoot = opts.outdir;

	watcher.on('change', function (file, stat) {
		try {
			logger.log('info', '=== Rebuilding: %s Changed ===', path.relative(opts.package, file))

			// rebuild all the things!
			dev.package(opts).on('file', add);
		} catch (e) {
			logger.log('error', 'Something failed ... /sadtrombone', e)
		}
	});

	function add (file) {
		watcher.add(file);
	}
	
	dev.package(opts).on('done', function () {
		
		app.use(express.static(opts.webRoot));
		
		server = app.listen(opts.port, addr, function () {
			var addr = server.address();
			logger.log('info', 'server is listening on %s:%s', addr.address, addr.port);
		});
	}).on('file', add);
};