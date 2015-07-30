'use strict';

var
	path = require('path'),
	util = require('util'),
	fs = require('fs');

var
	EventEmitter = require('events').EventEmitter;

var
	Watcher = require('../Watcher');

var
	express = require('express');

var
	cli = require('../cli-logger'),
	logger = require('../logger'),
	log = logger.child({component: 'Server'});

module.exports = Server;

function Server (opts) {
	if (!(this instanceof Server)) return new Server(opts);
	
	EventEmitter.call(this);
	
	this.options = opts || {};
	
	var
		server = this,
		watcher;
	
	this._running = false;
	
	log.level(opts.logLevel);
	
	if (opts.watch) {
		
		this._READY = false;
		
		process.nextTick(function () {
			log.info('setting up watcher');
			watcher = server._watcher = Watcher(opts);
			watcher.on('build', function () {
				log.info('rebuilding source');
				cli('rebuilding source');
				server.emit('build');
			});
			watcher.on('end', function (e) {
				log.info('%s', e ? 'build failed' : 'build succeeded');
				cli('%s%s', e ? 'build failed but the packager recovered' : 'build succeeded',
					e ? (' ' + e.toString()) : '');
				server.emit('end');
			});
			watcher.once('ready', function () {
				log.debug('watcher emitted ready event, firing ready');
				server._READY = true;
				server.emit('ready');
			});
		});
	} else {
		
		log.info('no watcher needed, already ready');
		
		this._READY = true;
	}
}

util.inherits(Server, EventEmitter);

Server.prototype.run = function (opts) {
	
	var
		server = this,
		app, cfg, port, hostname, root, srv;
	
	log.debug('attempting to run%s', !this._READY ? ' but the server is not ready' : '');
	
	if (!this._READY) this.once('ready', this.run.bind(this, opts));
	if (this._READY && !this._running) {
		
		log.info('starting the server');
		
		this.setup(opts);
		this._running = true;
		
		app = this._express;
		cfg = this._config;
		port = this._port;
		hostname = this._hostname;
		root = this._root;
		
		srv = this._srv = app.listen(port, hostname, function () {
			var
				a = srv.address(),
				p = a.port,
				h = a.address;
			
				cli('server listening at %s:%s', h, p);
				
				log.info('server listening at %s:%s', h, p);
				
				server.emit('run');
		});
		
	}
	return this;
};

Server.prototype.stop = function () {
	if (this._running) {
		
		log.info('stopping the server');
		
		cli('stopping server');
		this._server.close();
		this._server = null;
		this._running = false;
		this.emit('stop');
	}
	return this;
};

Server.prototype.setup = function (opts) {
	this.stop();
	
	// if no additional options are set and we've already been running, we don't overwrite the
	// current configuration
	if (!opts && this._express) return this;

	log.info('running setup %s custom options', opts ? 'with' : 'without');

	opts = opts || this.options;
	
	var
		app = express(),
		port = opts.port,
		localOnly = opts.localOnly,
		hostname = localOnly ? '127.0.0.1' : (opts.bindAddress || '0.0.0.0'),
		root, cfg;
	
	cfg = {
		dotfiles: 'ignore',
		etag: true,
		extensions: false,
		index: opts.outfile,
		lastModified: true,
		maxAge: 100,
		redirect: true
	};
	
	root = opts.webRoot || (!opts.watch ? (opts.cwd || process.cwd()) : opts.outdir);
	
	app.use(express.static(root, cfg));
	
	this._express = app;
	this._hostname = hostname;
	this._port = port;
	this._config = cfg;
	this._root = root;
	
	if (log.debug()) {
		var d = {
			// hostname is reserved by the logger...
			host: hostname,
			port: port,
			configuration: cfg,
			root: root
		};
		log.debug(d, 'final options set');
	}
	
	return this;
};