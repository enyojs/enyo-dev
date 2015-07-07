(function (require, request) {
	
	var
		manifest = {},
		resolved = {},
		entries = [];
	
	require = window.require = require || function (name) {
		
		var
			id = name,
			entry,
			method,
			map,
			data,
			require_,
			request_;
		
		if (typeof (entry = manifest[id]) == 'string') {
			id = entry;
		}
		
		if ((entry = resolved[id])) return entry;
		if (!(entry = manifest[id])) throw 'unable to find module ' + name;
		method = entry[0];
		map = entry[1];
		data = {exports: {}};
		require_ = function (n) {
			return require(map[n] == null ? n : map[n]);
		};
		request_ = function (n) {
			return request(map[n] == null ? n : map[n]);
		};
		method(data, data.exports, window, require_, request_);
		return (resolved[id] = data.exports);
	};
	
	request = window.request = request || function (name, loading) {
		if (!(this instanceof request)) return new request(name, loading);

		var
			id = name,
			callbacks = [],
			entry,
			el,
			finish,
			fired = false,
			finished = false,
			relay;
		
		if (typeof (entry = manifest[id]) == 'string') {
			id = entry;
		}
		
		this.then = function (cb) {
			callbacks.push(cb);
			if (finished) {
				relay(name);
			} else {
				if (!fired) finish();
			}
			return this;
		};
		
		relay = function (id) {
			setTimeout(function () {
				var cb = callbacks.shift();
				while (cb) {
					cb(id && require(id));
					cb = callbacks.shift();
				}
			}, 0);
		};
		
		finish = function () {
			
			fired = true;
			
			if (entry.bundles && entry.bundles.length) {
				var next = entry.bundles.shift();
				return request(next, true).then(finish);
			};
			
			if (entry.source) {
				el = document.createElement('script');
				el.onload = function () {
					finished = true;
					relay(!loading && name);
				};
				el.onerror = function () { throw 'failed to retrieve requested bundle for module ' + name + ' from ' + entry.source; };
				el.async = true;
				el.src = entry.source;
				document.head.appendChild(el);
			}
		
			if (entry.style) {
				el = document.createElement('link');
				el.rel = 'stylesheet';
				el.href = entry.style;
				document.head.appendChild(el);
			}
		};
		
		if ((entry = resolved[id])) {
			finished = true;
			return;
		}
		
		if (typeof (entry = manifest[id]) != 'object') throw 'unable to find bundle for module ' + name;
	};
	
	if (require.manifest) {
		for (var id in manifest) {
			var prev = require.manifest[id];
			if (!prev || !(prev instanceof Array)) require.manifest[id] = manifest[id];
		}
		manifest = require.manifest;
	} else require.manifest = manifest;
	
	for (var i = 0; i < entries.length; ++i) require(entries[i]);
})(window.require, window.request);