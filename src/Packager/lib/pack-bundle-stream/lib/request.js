// the stub placed in request-enabled bundle wrapper code, expected to always execute within
// the scope of a bundle wrapper with access to its own variables
(function () {
	if (!scope.Promise) throw new Error('No Promise implementation found, please provide a polyfill for this platform');
	var   request = enyo.request || (defineProperty(enyo, 'request', {value: enyoRequest}) && enyo.request)
		, pending = enyo.__pendingRequests__ || (defineProperty(enyo, '__pendingRequests__', {value: {}}) && enyo.__pendingRequests__)
		, Request = enyo.__Request__;
	
	if (!Request) {
		/*
		This class is a facade of a Promise instance. It is returned from enyoRequest because
		an actual Promise instance fires its executor method immediately upon instantiation.
		A tenant of our "request" mechanism is that it does not fire until the first time a
		"then" handler is passed to it. Here, we facade the normal behavior by passing a nop to
		the internal Promise instance and borrow its actual resolve/reject methods for our
		own "real" executor.
		*/
		Request = function Request (target, exec) {
			var resolve, reject, promise, fired;
			promise = new Promise(function (r1, r2) {
				resolve = r1;
				reject  = r2;
			});
			this.then = function then () {
				promise.then.apply(promise, arguments);
				if (!fired) {
					fired = true;
					exec(resolve, reject);
				}
			};
		};
		defineProperty(enyo, '__Request__', {value: Request});
		defineProperty(enyoRequest, 'isRequest', {value: isRequest});
		defineProperty(enyo, 'isRequest', {value: isRequest});
	}
	
	function enyoRequest (target) {
		var req = pending[target];
		if (!req) {
			req = pending[target] = new Request(target, function (resolve, reject) {
				var entry, deps;
				
				function handle () {
					try {
						resolve(require(target));
					} catch (e) {
						reject(e);
					}
				}
				
				function send () {
					var el;
					if (entry.style) {
						el      = document.createElement('link');
						el.rel  = 'stylesheet';
						el.href = entry.style;
						document.head.appendChild(el);
					}
					if (entry.source) {
						el = document.createElement('script');
						el.onload  = function () {
							resolve();
						};
						el.onerror = function (e) {
							reject(new Error(
								'Error loading module "' + target + '":\n\n' + e.stack + '\n'
							));
						};
						el.async   = true;
						el.src     = entry.source;
						document.head.appendChild(el);
					}
				}
				
				// if it has already been resolved, we're done
				if (exported.hasOwnProperty(target)) {
					return handle();
				}
				
				entry = manifest[target];
				if (!entry) throw new Error('Could not find module "' + target + '"');
				if (typeof entry == 'string') {
					return request(entry).then(function () {
						handle();
					});
				}
				if (!(entry.source || entry.style) && !(entry instanceof Array)) throw new Error(
					'The shared module manifest has been corrupted, the module is invalid "' + target + '"'
				);
				if (entry instanceof Array) {
					return handle();
				}
				if (entry.dependencies && entry.dependencies.length) {
					deps = entry.dependencies.map(function (name) {
						return new Promise(function (resolve) {
							request(name).then(resolve);
						});
					});
					Promise.all(deps).then(send);
				} else send();
			});
		}
		return req;
	}
	
	function isRequest (req) {
		return req != null && req instanceof Request;
	}	
})();
