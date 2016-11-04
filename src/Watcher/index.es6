'use strict';

import {EventEmitter}            from 'events';
import path                      from 'path';
import chokidar                  from 'chokidar';
import {default as logger,fatal} from '../logger';
import Packager                  from '../Packager';
import {validate}                from '../Packager/lib/cache-manager';

let log;

export default class Watcher extends EventEmitter {
	constructor ({opts, env}) {
		if (opts.production) fatal(`Cannot run Watcher in "production" mode`);
		super();
		log = logger(opts).child({component: 'watcher'});
		log.level(opts.logLevel || 'warn');
		opts.env      = env;
		this.options  = opts;
		this.TIMER_ID = null;
		this.LTSTAMP  = null;
		this.BUILDING = false;
		this.BWAITING = false;
		this.TWAIT    = 850; // ms
		this.CACHE    = opts.cache;
		this.init();
	}
	init () {
		let opts = this.options;
		
		this.packagerInit();
		this.monitorInit();
		
		if (!opts.trustCache || !opts.cache || !Array.isArray(opts.cache)) {
			this.notice('Creating initial build');
			log.info('Need to build from source, cannot trust the cache');
			this.options.cache = [];
			this.build();
		} else log.info('Trusting the existing cache and installing the monitor');
	}
	build () {
		if (!this.BUILDING) {
			log.trace('Beginning build, validating cache');
			this.options.cache = validate(this.options.cache, this.options) || [];
			this.BUILDING = true;
			this.emit('build');
			try {
				this.PACKAGER.run(this.options);
			} catch (err) {
				log.trace('Packaging failed', err);
				log.warn('Build failed, resetting Packager and waiting for another change before trying again');
				this.PACKAGER.destroy();
				this.PACKAGER = null;
				this.packagerInit();
				this.packagerEnd(err);
			}
		}
	}
	packagerInit () {
		let   opts     = this.options
			, env      = opts.env
			, packager = this.PACKAGER = new Packager({opts, env});
	
		log.debug('Initializing new Packager instance');
	
		packager.on('cache', cache => this.packagerCache(cache));
		packager.on('end'  , err   => this.packagerEnd(err));
	}
	packagerEnd (err) {
		this.BUILDING = false;
		if (this.BWAITING) {
			log.trace('Build waiting flag set, clearing and triggering new build, will not issue end event until all builds complete');
			this.BWAITING = false;
			return this.build();
		}
		this.notice(`Build completed ${err ? 'with' : 'without'} errors`);
		this.emit('end', err);
	}
	packagerCache (cache) {
		log.trace('Received cache from Packager');
		this.CACHE = this.options.cache = cache;
		this.emit('cache', cache);
	}
	monitorInit () {
		let   opts   = this.options
			, outDir = opts.outDir
			, cwd    = opts.package || opts.cwd;
		
		if (!this.MONITOR) {
			
			log.info('Initializing filesystem monitor');
			
			let monitor = this.MONITOR = chokidar.watch(cwd, {
				ignoreInitial: true,
				usePolling: !! opts.polling,
				interval: !! opts.polling && opts.pollingInterval,
				ignored: [
					/[\/\\]\./,
					// this will be absolute path because of setup()
					outDir,
					'**/node_modules'
				]
			});
			monitor.on('ready' , ()     => this.monitorReady());
			monitor.on('error' , (err)  => this.monitorError(err));
			monitor.on('change', (file) => this.monitorChange(file));
			monitor.on('add'   , (file) => this.monitorAdd(file));
		}
	}
	monitorReady () {
		log.info('Monitor installed and ready');
		this.emit('ready');
	}
	monitorError (err) {
		log.debug('Failed to install monitor', err);
		fatal('Failed to install filesystem monitor');
	}
	monitorChange (file) {
		log.trace(`Received "change" event "${file}"`);
		this.trigger();
	}
	monitorAdd (file) {
		log.trace(`Received "add" event "${file}"`);
		this.trigger();
	}
	trigger (update = true) {
		if (this.TIMER_ID == null) {
			log.trace('Triggering timer');
			this.TIMER_ID = setTimeout(() => {
				let   [ds,dn] = process.hrtime(this.LTSTAMP)
					, diff    = ds * 1000 + dn * 1e-6;
				log.trace(`Timer check: ${diff}ms (${ds}s + ${dn}ns)`);
				this.TIMER_ID = null;
				if (diff > this.TWAIT) {
					log.trace('Threshold was satisfied, will trigger build');
					if (this.BUILDING) {
						this.BWAITING = true;
					} else {
						this.notice('File change detected; rebuilding');
						this.build();
					};
				} else {
					log.trace('Threshold bounced, resetting the timer');
					this.trigger(false);
				}
			}, 800);
		}
		if (update) this.LTSTAMP = process.hrtime();
	}
	notice (...args) {
		let level = log.level();
		log.level('info');
		log.info(...args);
		log.level(level);
	}
}
