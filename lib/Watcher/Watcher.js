'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _chokidar = require('chokidar');

var _chokidar2 = _interopRequireDefault(_chokidar);

var _logger = require('../logger');

var _logger2 = _interopRequireDefault(_logger);

var _Packager = require('../Packager');

var _Packager2 = _interopRequireDefault(_Packager);

var _cacheManager = require('../Packager/lib/cache-manager');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var log = void 0;

var Watcher = function (_EventEmitter) {
	_inherits(Watcher, _EventEmitter);

	function Watcher(_ref) {
		var opts = _ref.opts,
		    env = _ref.env;

		_classCallCheck(this, Watcher);

		if (opts.production) (0, _logger.fatal)('Cannot run Watcher in "production" mode');

		var _this = _possibleConstructorReturn(this, (Watcher.__proto__ || Object.getPrototypeOf(Watcher)).call(this));

		log = (0, _logger2.default)(opts).child({ component: 'watcher' });
		log.level(opts.logLevel || 'warn');
		opts.env = env;
		_this.options = opts;
		_this.TIMER_ID = null;
		_this.LTSTAMP = null;
		_this.BUILDING = false;
		_this.BWAITING = false;
		_this.TWAIT = 850; // ms
		_this.CACHE = opts.cache;
		_this.init();
		return _this;
	}

	_createClass(Watcher, [{
		key: 'init',
		value: function init() {
			var opts = this.options;

			this.packagerInit();
			this.monitorInit();

			if (!opts.trustCache || !opts.cache || !Array.isArray(opts.cache)) {
				this.notice('Creating initial build');
				log.info('Need to build from source, cannot trust the cache');
				this.options.cache = [];
				this.build();
			} else log.info('Trusting the existing cache and installing the monitor');
		}
	}, {
		key: 'build',
		value: function build() {
			if (!this.BUILDING) {
				log.trace('Beginning build, validating cache');
				this.options.cache = (0, _cacheManager.validate)(this.options.cache, this.options) || [];
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
	}, {
		key: 'packagerInit',
		value: function packagerInit() {
			var _this2 = this;

			var opts = this.options,
			    env = opts.env,
			    packager = this.PACKAGER = new _Packager2.default({ opts: opts, env: env });

			log.debug('Initializing new Packager instance');

			packager.on('cache', function (cache) {
				return _this2.packagerCache(cache);
			});
			packager.on('end', function (err) {
				return _this2.packagerEnd(err);
			});
		}
	}, {
		key: 'packagerEnd',
		value: function packagerEnd(err) {
			this.BUILDING = false;
			if (this.BWAITING) {
				log.trace('Build waiting flag set, clearing and triggering new build, will not issue end event until all builds complete');
				this.BWAITING = false;
				return this.build();
			}
			this.notice('Build completed ' + (err ? 'with' : 'without') + ' errors');
			this.emit('end', err);
		}
	}, {
		key: 'packagerCache',
		value: function packagerCache(cache) {
			log.trace('Received cache from Packager');
			this.CACHE = this.options.cache = cache;
			this.emit('cache', cache);
		}
	}, {
		key: 'monitorInit',
		value: function monitorInit() {
			var _this3 = this;

			var opts = this.options,
			    outDir = opts.outDir,
			    cwd = opts.package || opts.cwd;

			if (!this.MONITOR) {

				log.info('Initializing filesystem monitor');

				var monitor = this.MONITOR = _chokidar2.default.watch(cwd, {
					ignoreInitial: true,
					usePolling: !!opts.polling,
					interval: !!opts.polling && opts.pollingInterval,
					ignored: [/[\/\\]\./,
					// this will be absolute path because of setup()
					outDir, '**/node_modules']
				});
				monitor.on('ready', function () {
					return _this3.monitorReady();
				});
				monitor.on('error', function (err) {
					return _this3.monitorError(err);
				});
				monitor.on('change', function (file) {
					return _this3.monitorChange(file);
				});
				monitor.on('add', function (file) {
					return _this3.monitorAdd(file);
				});
			}
		}
	}, {
		key: 'monitorReady',
		value: function monitorReady() {
			log.info('Monitor installed and ready');
			this.emit('ready');
		}
	}, {
		key: 'monitorError',
		value: function monitorError(err) {
			log.debug('Failed to install monitor', err);
			(0, _logger.fatal)('Failed to install filesystem monitor');
		}
	}, {
		key: 'monitorChange',
		value: function monitorChange(file) {
			log.trace('Received "change" event "' + file + '"');
			this.trigger();
		}
	}, {
		key: 'monitorAdd',
		value: function monitorAdd(file) {
			log.trace('Received "add" event "' + file + '"');
			this.trigger();
		}
	}, {
		key: 'trigger',
		value: function trigger() {
			var _this4 = this;

			var update = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

			if (this.TIMER_ID == null) {
				log.trace('Triggering timer');
				this.TIMER_ID = setTimeout(function () {
					var _process$hrtime = process.hrtime(_this4.LTSTAMP),
					    _process$hrtime2 = _slicedToArray(_process$hrtime, 2),
					    ds = _process$hrtime2[0],
					    dn = _process$hrtime2[1],
					    diff = ds * 1000 + dn * 1e-6;

					log.trace('Timer check: ' + diff + 'ms (' + ds + 's + ' + dn + 'ns)');
					_this4.TIMER_ID = null;
					if (diff > _this4.TWAIT) {
						log.trace('Threshold was satisfied, will trigger build');
						if (_this4.BUILDING) {
							_this4.BWAITING = true;
						} else {
							_this4.notice('File change detected; rebuilding');
							_this4.build();
						};
					} else {
						log.trace('Threshold bounced, resetting the timer');
						_this4.trigger(false);
					}
				}, 800);
			}
			if (update) this.LTSTAMP = process.hrtime();
		}
	}, {
		key: 'notice',
		value: function notice() {
			var _log;

			var level = log.level();
			log.level('info');
			(_log = log).info.apply(_log, arguments);
			log.level(level);
		}
	}]);

	return Watcher;
}(_events.EventEmitter);

exports.default = Watcher;