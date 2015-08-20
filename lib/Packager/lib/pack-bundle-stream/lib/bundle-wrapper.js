(function (scope) {
	'use strict';
	var require, manifest, exported, entries, request;

	// if there is already a global require method exposed from somewhere we will find it now
	require = scope.require;

	// below is where the generated manifest will be placed
	/*manifest*/

	// below is where the generated entries list will be assigned if there is one
	/*entries*/

	// if a different require exists then we can't actually work because we don't know the call-
	// pattern of the existing function to be able to consume it
	// @todo it could be possible to use an alternate name internally when another one exists but
	// this would lead to inconsistency of expectations to end-devs in the promise that we expose
	// our module's via the require function
	if (require && !require.hasOwnProperty('enyo')) {
		throw new TypeError('Incompatible require function found in scope');
	}
	if (!require || typeof require != 'function') {
		require = scope.require = function (target) {
			var entry, exports, ctx, map, mod, value;
			// it may have already been resolved
			if (exported.hasOwnProperty(target)) return exported[target];
			entry = manifest[target];
			if (!entry) throw new TypeError(
				'Could not find the required module: "' + target + '"'
			);
			if (!(entry instanceof Array)) {
				if (typeof entry == 'object' && (entry.source || entry.style)) {
					throw new TypeError(
						'Attempt to require a requested module: "' + target + '"'
					);
				} else if (typeof entry == 'string') {
					throw new TypeError(
						'Attempt to require a bundle entry: "' + target + '"'
					);
				}
				throw new TypeError(
					'The shared manifest has been corrupted, the module is invalid: "' + target + '"'
				);
			}
			mod = entry[0];
			map = entry[1];
			if (typeof mod != 'function') throw new TypeError(
				'The shared manifest has been corrupted, the module is invalid: "' + target + '"'
			);
			ctx = {exports: {}};
			mod(
				ctx,
				ctx.exports,
				// primarily for sanity/debugging will give a little bit more context when errors
				// are encountered
				function (name) {
					try {
						return require(map && map.hasOwnProperty(name) ? map[name] : name);
					} catch (e) {
						throw new Error(
							'While executing module "' + target + '", enountered an exception:\n\n' + e.stack + '\n'
						);
					}
				},
				// may be undefined, but only in cases where it won't be called
				request
			);
			exports = exported[target] = ctx.exports;
			return exports;
		};
		if (Object.definedProperty) Object.defineProperty(require, 'enyo', {
			value: true,
			enumerable: false,
			configurable: false,
			writable: false
		});
		else require.enyo = true;
	}

	// in occassions where requests api are being used, below this comment that implementation will
	// be injected
	/*request*/

	// if another bundle has already established the shared manifest we need to update it with
	// our modules
	if (require.manifest) {
		Object.keys(manifest).forEach(function (key) {
			var value = manifest[key], existing;
			if ((existing = require.manfiest[key])) {
				console.log('attempting to overwrite existing manifest entry %s', key, existing, value);
				if (typeof existing != 'string') return console.log('not overwriting');
			}
			require.manifest[key] = value;
		});
		manifest = require.manifest;
		exported = require.exported;
	}
	// otherwise we need to set it to our manifest
	else {
		if (Object.defineProperty) {
			Object.defineProperty(require, 'manifest', {
				value: manifest,
				enumerable: false,
				configurable: false,
				writable: false
			});
			Object.defineProperty(require, 'exported', {
				value: (exported = {}),
				enumerable: false,
				configurable: false,
				writable: false
			});
		} else {
			require.manifest = manifest;
			require.exported = (exported = {});
		}
	}

	// if this bundle contains any entries that need to be executed it will do that now
	if (entries && entries instanceof Array) entries.forEach(function (name) { require(name); });
})(this);