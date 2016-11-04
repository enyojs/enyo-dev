'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _init = require('./lib/options/init');

var _init2 = _interopRequireDefault(_init);

var _link = require('./lib/options/link');

var _link2 = _interopRequireDefault(_link);

var _unlink = require('./lib/options/unlink');

var _unlink2 = _interopRequireDefault(_unlink);

var _pack = require('./lib/options/pack');

var _pack2 = _interopRequireDefault(_pack);

var _templates = require('./lib/options/templates');

var _templates2 = _interopRequireDefault(_templates);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = [_init2.default, _link2.default, _templates2.default, _unlink2.default, _pack2.default];