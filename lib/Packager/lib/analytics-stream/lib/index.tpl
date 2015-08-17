doctype html
html(lang="en")
	head
		meta(charset="utf-8")
		meta(http-equiv="x-ua-compatible", content="ie=edge")
		meta(name="viewport", content="width=device-width, initial-scale=1")
		title #{package}: Analysis of Modules
		each stylesheet in stylesheets
			style!= stylesheet.contents
	body
		.general
			h1 #{package}
			table
				tr
					td bundles
					td #{bundleCount}
				tr
					td modules
					td #{moduleCount}
		.bundles
			h1 bundles
			ul
				each bundle in bundles
					li= bundle.name
		.modules
			h1 modules
			ul
				each module in modules
					li= module.relName
		#bundles-graph
		#modules-graph
		each script in scripts
			if script.src
				script(src=script.src)
			else
				script!= script.contents