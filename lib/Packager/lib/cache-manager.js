'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.CacheStream = exports.validate = exports.readCache = exports.writeCache = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = cacheStream;

var _stream = require('stream');

var _clone = require('clone');

var _clone2 = _interopRequireDefault(_clone);

var _utilExtra = require('../../util-extra');

var _logger = require('../../logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var didSet = void 0,
    baseLog = void 0;

function getLog(opts) {
	if (!didSet) {
		baseLog = (0, _logger2.default)(opts).child({ component: 'cache' });
		baseLog.level(opts.logLevel || 'warn');
		didSet = true;
	}
	return baseLog;
}

var resetKeys = ['request', 'dependents', 'dependencies', 'bundle', 'bundleName', 'origins', 'rawContents', 'styleEntries', 'assetEntries', 'trace'];

var CacheStream = function (_Transform) {
	_inherits(CacheStream, _Transform);

	function CacheStream(opts) {
		_classCallCheck(this, CacheStream);

		var _this = _possibleConstructorReturn(this, (CacheStream.__proto__ || Object.getPrototypeOf(CacheStream)).call(this, { objectMode: true }));

		_this.options = opts;
		_this._modules = [];
		_this._bundles = [];
		_this.log = getLog(opts);
		return _this;
	}

	_createClass(CacheStream, [{
		key: '_transform',
		value: function _transform(bundle, nil, next) {
			var opts = this.options,
			    modules = this._modules,
			    bundles = this._bundles;
			if (opts.cache) {
				Object.keys(bundle.modules).forEach(function (name) {
					modules.push(bundle.modules[name]);
				});
				bundles.push(bundle);
				next();
			} else next(null, bundle);
		}
	}, {
		key: '_flush',
		value: function _flush(done) {
			var _this2 = this;

			var opts = this.options,
			    bundles = this._bundles,
			    modules = this._modules,
			    cache = void 0,
			    err = void 0;
			if (opts.cache) {
				this.log.info({ file: opts.cacheFile }, 'Attempting to write the cache file');
				cache = [];
				modules.forEach(function (mod) {
					return cache.push(_this2._getCacheEntry(mod));
				});
				this.emit('cache', cache);
				err = writeCache(opts.cacheFile, cache);
				if (err) {
					this.log.trace('Failed to write the cache file "' + opts.cacheFile + '"', err);
					(0, _logger.fatal)('Failed to write the cache file "' + opts.cacheFile + '"');
				}
				bundles.forEach(function (bundle) {
					return _this2.push(bundle);
				});
				this.push(null);
			}
			done();
		}
	}, {
		key: '_getCacheEntry',
		value: function _getCacheEntry(mod) {
			var ret = (0, _clone2.default)(mod);
			resetKeys.forEach(function (key) {
				return delete ret[key];
			});
			ret.contents = mod.rawContents;
			return ret;
		}
	}]);

	return CacheStream;
}(_stream.Transform);

function cacheStream(opts) {
	return new CacheStream(opts);
}

function writeCache(file, data) {
	return _utilExtra.fsync.writeJson(file, data);
}

function readCache(file, opts) {
	var log = getLog(opts);
	log.debug({ file: file }, 'Attempting to read and validate the cache "' + file + '"');

	var _fsync$readJson = _utilExtra.fsync.readJson(file),
	    json = _fsync$readJson.result,
	    error = _fsync$readJson.error;

	if (!error) {
		log.debug('Successfully read the cache file "' + file + '"');
		return validate(json, opts);
	} else {
		log.trace('Failed to reach cache file "' + file + '"', error);
		return error;
	}
}

function validate(json, opts) {
	var log = getLog(opts);

	if (!Array.isArray(json)) {
		log.debug('JSON file was corrupt');
		return false;
	}

	var ret = json.filter(function (entry) {
		var result = entry.isPackage ? validatePackage(entry) : validateFile(entry);
		log.trace(result ? 'Keeping entry "' + entry.fullpath + '"' : 'Discarding entry "' + entry.fullpath + '"');
		return result;
	});

	log.debug('Able to retain ' + ret.length + ' of ' + json.length + ' entries from the cache');

	return ret;
}

function validatePackage(entry) {
	var main = entry.main,
	    pkg = entry.packageFile;
	return (main ? stat(main, entry.mtime[main]) : true) && (pkg ? stat(pkg, entry.mtime[pkg]) : true);
}

function validateFile(entry) {
	return stat(entry.fullpath, entry.mtime);
}

function stat(file, mtime) {
	var stat = _utilExtra.fsync.stat(file);
	return stat ? mtime >= stat.mtime.getTime() : false;
}

exports.writeCache = writeCache;
exports.readCache = readCache;
exports.validate = validate;
exports.CacheStream = CacheStream;