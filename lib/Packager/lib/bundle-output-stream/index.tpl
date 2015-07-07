<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta http-equiv="x-ua-compatible" content="ie=edge">
	<title>{{if devMode}}[DEVELOPMENT] {{/if}}{{title}}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	{{stylesheets}}
	{{if href}}<link rel="stylesheet" href="{{href}}"/>{{else}}<style>{{contents}}</style>{{/if}}{{/stylesheets}}
	{{scripts}}<script{{if src}} src="{{src}}">{{else}}>{{contents}}{{/if}}</script>
	{{/scripts}}
</head>
<body>
</body>
</html>