// the stub placed in request-enabled bundle wrapper code, expected to always execute within
// the scope of a bundle wrapper with access to its own variables
(function () {
	var Promise, promises, request;
	// @temporary rough replacement to get moving but need to look for actual compliant polyfill
	Promise = scope.Promise || function (action) {
		throw new Error('No polyfill for Promise implemented on this platform');
	};
	
	// if there is already a global request method exposed from somewhere we will find it now
	request = scope.request;

	// if a different request exists then we can't actually work because we don't know the call-
	// pattern of the existing function to be able to consume it
	// @todo it could be possible to use an alternate name internally when another one exists but
	// this would lead to inconsistency of expectations to end-devs in the promise that we expose
	// our module's via the require function
	if (request && !request.hasOwnProperty('enyo')) {
		throw new Error('Incompatible request function found in scope');
	}

	if (!request || typeof request != 'function') {
		
		/**
		* This is a temporary implementation while other more complete and less hacky solutions
		* are being explored.
		*/
		function Request (target, executor) {
			var resolve, reject, promise, fired;
			/*{debug}*/console.log('request: target -> %s instantiating Request', target);
			promise = new Promise(function (_resolve, _reject) {
				resolve = _resolve;
				reject = _reject;
			});
			this.then = function () {
				promise.then.apply(promise, arguments);
				if (!fired) {
					/*{debug}*/console.log('request: target -> %s actually executing Request executor', target);
					fired = true;
					executor(resolve, reject);
				}
			};
		}
		
		request = scope.request = function (target) {
			var exists = promises[target];
			/*{debug}*/console.log('request: target -> %s', target);
			// if exists then we are still returning a Promise
			if (exists) {
				/*{debug}*/console.log('request: target -> %s already existed as promise', target);
				return exists;
			}
			exists = promises[target] = new Request(target, function (resolve, reject) {
				var entry, handle, el;
				handle = function () {
					try {
						/*{debug}*/console.log('request: target -> %s attempting to require value', target);
						resolve(require(target));
					} catch (e) {
						reject(e);
					}
				};
				// it has already been resolved by a require statement at some point
				if (exported.hasOwnProperty(target)) {
					/*{debug}*/console.log('request: target -> %s has already been resolved, handling', target);
					return handle(target);
				}
				entry = manifest[target];
				if (!entry) throw new TypeError(
					'Could not find the requested module: "' + target + '"'
				);
				if (typeof entry == 'string') {
					/*{debug}*/console.log('request: target -> %s is mapping to a bundle %s, requesting bundle', target, entry);
					// this is a map from a module to the bundle containing the module so we need
					// to wait until that is loaded to be able to continue
					return request(entry).then(function () {
						/*{debug}*/console.log('request: target -> %s resolved bundle %s, attempting to resolve', target, entry);
						return handle();
					});
				}
				if (!entry.source && !entry.style && !(entry instanceof Array)) throw new TypeError(
					'The shared manifest has been corrupted, the module is invalid: "' + target + '"'
				);
				if (entry instanceof Array) {
					/*{debug}*/console.log('request: target -> %s was already resolved as an array', target);
					// this means it was already loaded or was a request for a requirable module
					return handle();
				}
				// the style, if present, doesn't reflect on the JavaScript so it isn't a part of
				// the default resolution/request process and will report its own errors
				if (entry.style) {
					/*{debug}*/console.log('request: target -> %s contains style entry for %s', target, entry.style);
					el = document.createElement('link');
					el.rel = 'stylesheet';
					el.href = entry.style;
					document.head.appendChild(el);
				}
				if (entry.source) {
					/*{debug}*/console.log('request: target -> %s contains a source entry for %s', target, entry.source);
					el = document.createElement('script');
					el.onload = function () {
						/*{debug}*/console.log('request: target -> %s loaded', target);
						// when this happens the bundle will have already updated the global
						// manifest so we can just resolve the promise
						resolve();
					};
					el.onerror = function (e) {
						/*{debug}*/console.log('request: target -> %s failed to load with error', target, e);
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
	
	// promises is a shared map of named active promises to reduce the number of promises created
	// in a given runtime when accessing the same path
	promises = request.promises || (request.promises = {});
})();
