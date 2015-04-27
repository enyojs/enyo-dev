# enyo-dev

## Tools for developing and deploying Enyo apps

__enyo-dev__ is a module containing tools useful for packaging and deploying Enyo applications. At this time, the module only
contains the `enyo-pack` command.

> This document is under construction and is incomplete.

Currently this module is not published to npm, thus to install it you need to have a local copy of the repository on your system. In the directory where you would like the repository (for development, not in a `node_modules` directory!) issue the following command:

```bash
git clone https://github.com/enyojs/enyo-dev.git && \
	cd enyo-dev && \
	npm link
```

## Available tools

### enyo-pack

The `enyo-pack` command packages the source for an Enyo application. It may also be executed using the `epack` alias.

By default, `enyo-pack` will create a `dist` directory with an automatically generated `index.html` including both
the source and CSS for the application (a single file containing the output). Sources are specified in `package.json` file
in the [package] directory (by default, the current directory). The output can be customized using the options below.

To see a list of available options use `enyo-pack --help`

```bash
Usage: enyo-pack | epack [package] [options]

package     The relative path to the application directory to package

Options:
   -l, --log-level        What level of output to use [error, log, debug, info, verbose]  [info]
   -D, --dev-mode         Whether or not this build is a development build  [true]
   -I, --incremental      uses browserify-incremental to speed up future builds. Can either be true to use an in-memory cache or a path to persist the change cache across builds  [false]
   -L, --lib-path         The relative path from the package root to where the libraries can be found  [lib]
   --title                To set the <title> of the output project index
   --include-libs         This is a comma-separated, ordered list of libraries that have library-level options (package.json) that need to be included in the final build. If the library is explicitly required in the source it does not need to be in this list.
   -d, --outdir           Where to place the output files  [./dist]
   -o, --outfile          The output filename for the compiled application HTML  [index.html]
   -a, --asset-outdir     The directory for all assets in the package output, relative to outdir  [.]
   -K, --known-assets     When a project is only referencing assets from within CSS set this to ensure you only copy assets that are actually used into the final package
   -c, --css-outfile      If the compiled CSS should not be inserted into the packaged HTML file
   -j, --js-outfile       If the compiled JS should not be inserted into the packaged HTML file
   -t, --template-index   Instead of using the auto-generated HTML index, start from this file
```

Each of the command-line options has an equivalent option in the `package.json` file.

#### The package.json Options

```json
	{
		"main": "index.js",
		"styles": [],
		"assets": [],
		"package": "./",
		"logLevel": "debug",
		"devMode": false,
		"libPath": "../",
		"title": "My Project",
		"includeLibs": [],
		"outdir": "./dist",
		"outfile": "index.html",
		"outAssetDir": "",
		"outJsFile": "",
		"outCssFile": "",
		"templateIndex": "",
		"knownAssetsOnly": false
	}
```


### enyo-serve

The `enyo-serve` command packages the source for an Enyo application using `enyo-pack`, serves the
application via HTTP, and watches the source files so it can rebuild the app on a change. It may
also be executed using the `eserve` alias.

In addition to the options supported by `enyo-pack`, `enyo-serve` also supports three options
related to the HTTP server: `--localOnly`, `--web-root`, and `--port`.

To see a list of available options use `enyo-serve --help`

```bash
Usage: enyo-serve | eserve [package] [options]

package     The relative path to the application directory to package

Options:
   -l, --log-level        What level of output to use [error, log, debug, info, verbose]  [info]
   -D, --dev-mode         Whether or not this build is a development build  [true]
   -I, --incremental      uses browserify-incremental to speed up future builds. Can either be true to use an in-memory cache or a path to persist the change cache across builds  [false]
   -L, --lib-path         The relative path from the package root to where the libraries can be found  [lib]
   --title                To set the <title> of the output project index
   --include-libs         This is a comma-separated, ordered list of libraries that have library-level options (package.json) that need to be included in the final build. If the library is explicitly required in the source it does not need to be in this list.
   -d, --outdir           Where to place the output files  [./dist]
   -o, --outfile          The output filename for the compiled application HTML  [index.html]
   -a, --asset-outdir     The directory for all assets in the package output, relative to outdir  [.]
   -K, --known-assets     When a project is only referencing assets from within CSS set this to ensure you only copy assets that are actually used into the final package
   -c, --css-outfile      If the compiled CSS should not be inserted into the packaged HTML file
   -j, --js-outfile       If the compiled JS should not be inserted into the packaged HTML file
   -t, --template-index   Instead of using the auto-generated HTML index, start from this file
   -p, --port             The port to bind to for incoming requests  [8000]
   --localOnly            Whether or not to only accept connections from localhost  [false]
   -R, --web-root         The relative path from the current working directory to host files from
```

Unlike `enyo-pack`, the command-line options *cannot* be set via the `package.json` file.

### enyo-gen

> In very early/limited state. Currently, only one sub-command is available: init

The `enyo-gen` helper executable exposes other project initialization and scaffolding commands. It is aliased to `egen`.

#### Available sub-commands

##### init

This command is used to help initialize a new project or update an existing project. It has inherent knowledge of enyo-related libraries but can also be used to include and manage external [bower](http://bower.io/) dependencies (or anything accessible via a git-path).

```bash
Usage: enyo-gen | egen init [package] [options]

package     The relative path to the target directory, if it does not exist it will be created.

Options:
   -l, --log-level   What level of output to use [error, log, debug, info, verbose]  [info]
   --name            The name of the project. If not set it will attempt to find it from an available package.json file and if not found will default to the package name (directory)
   --libs            A comma-separated list of libraries to include that overrides the default of all enyo-related libraries. Additional libraries can be installed from git paths or bower.

		Example: --libs=moonstone,enyo=git@github.com:enyojs/enyo.git#master,enyo-ilib

   --link-libs       A comma-separated list of libraries to link from locally installed, bower-linked versions of the named dependent library. Note this requires the libraries to have been checked out on the current system and have had `bower link` executed in each.

		Example: --link-libs=moonstone,enyo

   --link-all-libs   Use this to indicate that all requested libraries are to be linked.  [false]
   --defaults        Use this when you already have dependencies in your bower.json file but also want to install any missing defaults. If any of the default libraries are listed their version will be used instead of the default  [false]
   --save            When installing dependencies, set this to preserve them to your bower.json file.  [false]

Initialize the target as an enyo project by installing necessary components in default locations. If no libs are specified, the default collection of enyo-related libraries will be installed. If a bower.json already exists with dependencies they will be used instead of the defaults (with preference given to any specified with the --libs option). To combine them with the defaults, use the --defaults flag.
```

## Copyright and License Information

Unless otherwise specified, all content, including all source code files and documentation files in
this repository are:

Copyright (c) 2012-2015 LG Electronics

Unless otherwise specified or set forth in the NOTICE file, all content, including all source code
files and documentation files in this repository are: Licensed under the Apache License, Version
2.0 (the "License"); you may not use this content except in compliance with the License. You may
obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License
is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing permissions and limitations under the
License.
