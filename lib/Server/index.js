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
		addr = opts.localOnly ? '127.0.0.1' : '0.0.0.0',
		watcher = filewatcher({debounce: 10}),
		server, packager;
	
	// @todo is this really the best way to do this?
	if (!opts.webRoot) opts.webRoot = opts.outdir;

	// always use devMode for the server
	opts.devMode = true;

	packager = dev.package(opts);
	packager.incremental = packager.incremental || true;
	packager.on('file', function (file) {
		logger.log('debug', 'Watcher: Watching %s', file);
		watcher.add(file);
	}).on('done', function () {
		if (!server) {
			app.use(express.static(opts.webRoot));
			
			server = app.listen(opts.port, addr, function () {
				var addr = server.address();
				logger.log('info', 'server is listening on %s:%s', addr.address, addr.port);
			});
		}
	}).run();

	watcher.on('change', function (file, stat) {
		logger.log('debug', 'Watcher: %s Changed', file);
		try {
			logger.log('info', '=== Rebuilding: %s Changed ===', path.relative(packager.package, file))

			// rebuild all the things!
			packager.run();
		} catch (e) {
			logger.log('error', 'Something failed ... /sadtrombone', e)
		}
	});
};