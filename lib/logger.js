'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.stdout = exports.fatal = undefined;

var _bunyan = require('bunyan');

var _bunyan2 = _interopRequireDefault(_bunyan);

var _bunyanFormat = require('bunyan-format');

var _bunyanFormat2 = _interopRequireDefault(_bunyanFormat);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// this is the "shared" root logging utility, the approach used in these tools is very flawed
// but full-scale changes has not been possible yet
var stream = (0, _bunyanFormat2.default)({ outputMode: 'short' }),
    log1 = _bunyan2.default.createLogger({ name: 'enyo-dev', stream: stream }),
    log2 = _bunyan2.default.createLogger({ name: 'enyo-dev' });

// common handler for fatal errors the output might be ugly but fatal errors should
// only occur when an edge case was unhandled
function fatal() {
	log1.fatal.apply(log1, arguments);
	process.exit(-1);
}

// here we map uncaught exceptions to be handled consistently and always exit abnormally
process.on('uncaughtException', fatal);

// we register this handler because if/when we hit these issues we need to try and
// understand where they come from since, ideally, they would all be handled
process.on('unhandledRejection', function (reason) {
	log1.trace({ reason: reason.toString() }, 'Unhandled Promise rejection event encountered, it is impossible to retrieve a stack-trace for this error');
	fatal('A fatal error has been encountered, please use "trace" logging for more information on this issue');
});

// to be able to print to the command line consistently for other es6 style modules
function stdout() {
	var _console;

	// @todo format!!
	(_console = console).log.apply(_console, arguments);
}

// there was a better way to do this but this was maintained due to time constraints
// and the logical flow from original winston
function getLogger() {
	var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

	return opts.logJson === true ? log2 : log1;
}

exports.default = getLogger;
exports.fatal = fatal;
exports.stdout = stdout;