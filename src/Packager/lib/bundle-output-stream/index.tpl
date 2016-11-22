doctype html
html(lang="en")
	head
		meta(charset="utf-8")
		meta(http-equiv="x-ua-compatible", content="ie=edge")
		meta(name="viewport", content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no")
		if devMode
			title [DEVELOPMENT] #{title}
		else
			title= title
		each stylesheet in stylesheets
			if stylesheet.href
				link(rel="stylesheet", href=stylesheet.href)
			else
				style!= stylesheet.contents
		each script in scripts
			if script.src
				script(src=script.src)
			else
				script!= script.contents
	body.enyo-unselectable