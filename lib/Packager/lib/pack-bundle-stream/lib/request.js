// the stub placed in request-enabled bundle wrapper code, expected to always execute within
// the scope of a bundle wrapper with access to its own variables
(function () {
	'use strict';
	var Promise, promises;
	// @temporary rough replacement to get moving but need to look for actual compliant polyfill
	Promise = scope.Promise || function (action) {
		throw new Error('No polyfill for Promise implemented on this platform');
	};

	// a map of existing promises for known targets to avoid race-conditions or duplicate requests
	promises = {};
	
	// if there is already a global require method exposed from somewhere we will find it now
	require = scope.require;

	// if a different request exists then we can't actually work because we don't know the call-
	// pattern of the existing function to be able to consume it
	// @todo it could be possible to use an alternate name internally when another one exists but
	// this would lead to inconsistency of expectations to end-devs in the promise that we expose
	// our module's via the require function
	if (request && !request.hasOwnProperty('enyo')) {
		throw new TypeError('Incompatible request function found in scope');
	}

	if (!request || typeof request != 'function') {
		request = scope.request = function (target) {
			var exists = promises[target];
			// if exists then we are still returning a Promise
			if (exists) return exists;
			exists = promises[target] = new Promise(function (resolve, reject) {
				var entry, handle, el;
				handle = function () {
					try {
						resolve(require(target));
					} catch (e) {
						reject(e);
					}
				};
				// it has already been resolved by a require statement at some point
				if (exported.hasOwnProperty(target)) {
					return handle(target);
				}
				entry = manifest[target];
				if (!entry) throw new TypeError(
					'Could not find the requested module: "' + target + '"'
				);
				if (typeof entry == 'string') {
					// this is a map from a module to the bundle containing the module so we need
					// to wait until that is loaded to be able to continue
					return request(entry).then(function () {
						// @todo: may not need to request this, possibly could require
						return request(target).then(handle);
					});
				}
				if (!entry.source && !entry.style && !(entry instanceof Array)) throw new TypeError(
					'The shared manifest has been corrupted, the module is invalid: "' + target + '"'
				);
				if (entry instanceof Array) {
					// this means it was already loaded or was a request for a requirable module
					return handle();
				}
				// the style, if present, doesn't reflect on the JavaScript so it isn't a part of
				// the default resolution/request process and will report its own errors
				if (entry.style) {
					el = document.createElement('link');
					el.rel = 'stylesheet';
					el.href = entry.style;
					document.head.appendChild(el);
				}
				if (entry.source) {
					el = document.createElement('script');
					el.onload = function () {
						// when this happens the bundle will have already updated the global
						// manifest so we can just resolve the promise
						handle();
					};
					el.onerror = function (e) {
						// there was a loading related error that needs to be reported
						reject(
							new Error(
								'Error loading module "' + target + '":\n\n' + e.stack + '\n'
							)
						);
					};
					el.async = true;
					el.src = entry.source;
					document.head.appendChild(el);
				}
			});
			return exists;
		};
		if (Object.definedProperty) Object.defineProperty(request, 'enyo', {
			value: true,
			enumerable: false,
			configurable: false,
			writable: false
		});
		else request.enyo = true;
	}
})();
