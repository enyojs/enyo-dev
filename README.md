## Enyo Developer Tools
> version 1.0.0

> __SPECIAL NOTICE__
> 
> There have been breaking changes in the configurations and environment setup between
> versions `0.5.2` and `1.0.0`. The new environment structure is explained 
> in the documentation below and with notes in [CHANGES.md](CHANGES.md). Some of the configuration
> options have changed or been removed as well as command line parameters and behaviors.

# Contents

* [Description](#description)
* [Setup](#setup)
	* [Requirements](#setup-reqs)
	* [Installation](#setup-install)
		* [NPM installation](#setup-npm)
		* [Manual installation](#setup-manual)
			* [Clean](#setup-manual-clean)
			* [Upgrade](#setup-manual-upgrade)
* [Environment Configuration](#env)
	* [User](#env-user)
		* [Links directory](#env-user-links)
	* [Project](#env-project)
		* [Project Configuration](#env-project-config)
* [Commands](#commands)
	* [init](#commands-init)
	* [link](#commands-link)
	* [unlink](#commands-unlink)
	* [templates](#commands-templates)
	* [pack](#commands-pack)
		* [Error handling/debugging](#commands-pack-errors)
		* [Automatic rebuilding](#commands-pack-auto-rebuild)
* [Asset Handling](#assets)
	* [How to include assets](#assets-how-to-include-assets)
	* [Referencing from style](#assets-referencing-from-style)
		* [Warning](#assets-referencing-from-style-warning)
	* [Referencing from JavaScript](#assets-referencing-from-javascript)
	* [How it works](#assets-how-it-works)
		* [conventions](#assets-conventions)

### <a name="description"></a>Description

The enyo-dev module is a collection of tools designed to aid in building Enyo applications using many current Web Standards and technologies. If following the designed conventions along with the tools it can significantly reduce the amount of generated source your applications require to function while also allowing you to build your assets and resources around your JavaScript dependency hierarchy.

### <a name="setup"></a>Setup

#### <a name="setup-reqs"></a>Requirements

In order to use these tools you need to ensure you have Node version `4.0.0` or higher. You can acquire [Node](https://nodejs.org/download/) in various ways including their pre-built binary or installation packages. Ensure that the correct version of Node and npm are available from the terminal/console of your operating system and that you have the correct permissions to install _npm packages globally_. You can check your current version of Node by issuing the following command:

```bash
node --version
```

> __WARNING__
>
> If for any reason installation fails and you had a previous version installed on your system it is advised
> that you ensure you remove your `~/.enyo` directory and try again. Efforts were made to avoid these issues
> but they could potentially still exist.

#### <a name="setup-install"></a>Installation

The easiest way to manage your installation of the tools is to use the [npm package manager](#setup-npm). In other cases you can follow the directions below for a [manual installation](#setup-manual).

##### <a name="setup-npm"></a>NPM Installation

```bash
npm install -g enyo-dev
```

##### <a name="setup-manual"></a>Manual Installation

A manual installation means you have a local _clone_ of the source code. This gives you control if you wish to debug issues with the tools or test new features but requires a few extra steps.

###### <a name="setup-manual-clean"></a>Clean

For a clean install on a system that does not currently have _enyo-dev_ installed follow these directions:

> Note that the documented version may be the _next_ version to be released and thus not yet available.

```bash
git clone https://github.com/enyojs/enyo-dev.git
cd enyo-dev
# if there is a version, use the next line and replace the version as appropriate
git checkout 1.0.0
npm install
npm link
```

###### <a name="setup-manual-upgrade"></a>Upgrade

If you already have a local clone of _enyo-dev_ and need to upgrade follow these instructions from the root of the local repository:

```bash
git pull
# if there is a version, use the next line and replace the version as appropriate
git checkout 1.0.0
npm install
npm prune
npm link
```

### <a name="env"></a>Environment Configuration

#### <a name="env-user"></a>User (normal use-case)

By default, the enyo developer tools need a location to store stateful information. For a typical user a directory `.enyo` will be created at the root level of the user's _home_ (differs per operating system - the equivalent of `~/` for OS X and Linux and `$HOME` for most Windows systems). It will create and store information in various files as needed.

##### <a name="env-user-links"></a>Links directory `~/.enyo/links`

When using the _links_ option within your projects the tools will create a separate directory at `~/.enyo/links` where it stores the global link to your local libraries. Subsequent requests in projects will link to _this location_ so you can modify the location of your library without invalidating all of the projects that may be linked to it. For more information on using _links_ in your development environment see the documentation below.

#### <a name="env-project"></a>Project

A project's configuration is determined by properties found in the `.enyoconfig` configuration file and the `package.json` file. Both files consist of JSON with specific properties. The available properties for the `.enyoconfig` file are those posted for the [project configuration](#env-project-config). The properties found in the `package.json` file are special because they are _directly related to the CommonJS module/package they define_.

The actual specification for a `package.json` file are part of the [CommonJS Specification for packages](http://wiki.commonjs.org/wiki/Packages/1.1). The options we add are a superset of options that can be defined for _any package_ in your project's and libraries. This is why they are defined in the `package.json` and not in the `.enyoconfig` file. Here are the additional properties we support in the `package.json` file:

```javascript
{
  // this is an array of file paths or glob patterns relative to this
  // package.json file that will be included as assets in every build
  "assets": [],
  
  // this is an array of file paths or glob patterns relative to this
  // package.json file that will be included as assets only in
  // development builds (can be useful for scaffold/test data
  "devAssets": [],
  
  // this is an array of file paths or glob patterns relative to this
  // package.json file that will be included as CSS/Less styling when
  // this package (or library) is included
  "styles": [],
  
  // this is a part of the CommonJS Specification for packages but is
  // used by our build-tools to determine the entry file for the
  // package when it is included
  "main": "index.js",
  
  // this is ONLY USED BY LIBRARIES to direct the build tools where to
  // begin their search for modules when they are requested 
  "moduleDir": "lib"
}
```

##### <a name="env-project-config"></a>Project configuration file `.enyoconfig`

The project _configuration file_ (`.enyoconfig`) is a special JSON file with properties that define your
project to the packager and environment assistant (internal component of the tools). This file _is required_
for it to know your project is, well, a project. These options differ from those added to the `package.json`
file in that these _only apply from the root of a project or library_, the properties in the `package.json`
file apply to _any CommonJS style modules/packages_. Below is an example file with the available options
defined with inline comments.

```javascript
{
  // the directory within the project where it should install included libraries
  "libDir": "lib",
  
  // the list of default libraries to be included in the project's "libDir"
  "libraries": [
    "enyo",
    "layout"
  ],
  
  // a map of library names to their location from where they can be retrieved
  "sources": {
    "enyo": "https://github.com/enyojs/enyo.git",
    "layout": "https://github.com/enyojs/layout.git"
  },
  
  // a map of library names to the intended target if it is not "master" and can
  // be a branch, tag or specific commit hash - if not present will be assumed as
  // "master"
  "targets": {
    "enyo": "master",
    "layout": "master"
  },
  
  // whether or not to build in production mode
  "production": false,
  
  // whether or not to build in developer mode, production mode supersedes this value
  "devMode": true,
  
  // whether or not to read/write from a cache file to speed up builds
  "cache": true,
  
  // write a new cache file but ignore the current file
  "resetCache": false,
  
  // used for --watch mode, if you have already built, this will
  // cause the server/system to startup almost instantly (as long as the cache is valid)
  "trustCache": false,
  
  // if set to true will delete all files in the outdir if they exist to ensure the only
  // files remaining after a build are related to the latest build
  "clean": false,
  
  // in developer mode, produce source-maps for debugging
  "sourceMaps": true,
  
  // to include external libraries in the final build
  "externals": true,
  
  // to stop the compilation if there are any missing asset or style files
  "strict": false,
  
  // names libraries to _not_ include in the build output
  "skip": [],
  
  // whether or not this is a library and should build in library mode
  "library": false,
  
  // in library mode, whether or not to include modules or packages marked as wip
  "wip": false,
  
  // the output directory for build files
  "outDir": "./dist",
  
  // when not in library mode, the name of the output HTML file
  "outFile": "index.html",
  
  // object entries with a "name" and "options" hash for the named less plugins
  "lessPlugins": [],
  
  // see the documentation for the command-line tool for more information, can be used to
  // prefix asset paths for libraries that will not be included in the final output
  "assetRoots": [],
  
  // only compile actual Less style, normally it allows Less to compile all styling
  "lessOnlyLess": false,
  
  // whether or not to minify the final style output
  "minifyCss": false,
  
  // only for production mode, whether or not the final style should be in a <style/> tag in the
  // HTML file or in its own loaded file
  "inlineCss": true,
  
  // only for production mode, the name of the output style file when "inlineCss" is false
  "outCssFile": "output.css",
  
  // only in production mode, the name of the output JavaScript file when "inlineJs" is false
  "outJsFile": "output.js",
  
  // only for production mode, whether or not the final JavaScript should be in a <script/> tag
  // in the HTML file or in its own loaded file
  "inlineJs": true,
  
  // if you have a custom HTML index template file this path should be relative to the current
  // working directory (if specified from command-line) or the root of the project if
  // specified in the configuration file
  "templateIndex": "",
  
  // whether or not to run the watcher utility
  "watch": false,
  
  // some systems will require polling, especially if using network-mounted filesystems
  "polling": false,
  
  // when using polling, this is the interval in milliseconds it will poll for changes
  "pollingInterval": 100,
    
  // add scripts before all other scripts in the final output, no meaning
  // in library mode
  "headScripts": [],
  
  // add scripts after all other scripts in the final output, no meaning
  // in library mode
  "tailScripts": [],
  
  // on platforms that do not have native Promise support set this to true to include it in
  // the final build
  "promisePolyfill": false,
  
  // unusual to set this to true in the configuration but possible, dictates whether to
  // only produce the style output or not
  "styleOnly": false,
  
  // an array of objects with "name" and "value" properties that will be turned into Less
  // variables and added at the end of all Less before it is compiled
  "lessVars": []
  
}
```

### <a name="commands"></a>Commands

All of the tools require various commands issued from the command-line. Below are a list of the available commands, their options and some typical use-case examples. The root `enyo` command is, by itself, not very useful (literally, does nothing). The sub-commands are where the magic happens. All boolean flags can be negated by using the full flag prefixed with `no` (e.g. `--user` can be negated by using `--no-user` or optionally `--user=false` etc). It should be noted that each sub-command shares these command-line flags:

```bash
--user
-l, --log-level
-v, --version
```

The `--user` option is always set to true by default. This allows the tools to interact with your user-level state files, links, templates, etc. In environments where these files do not exist and should not be created
or evaluated, make sure your commands include the `--no-user` or `--user=false` flags.

The `-v, --version` option simply prints the current version of the tools and exits.

The `-l, --log-level` option allows you to see more or less debugging information. Nearly all of the tools
share the same logging utility and thus respond to this value. It can be one of `trace,debug,warn,error,fatal`. The default is `warn` for all commands and in all scenarios.

#### <a name="commands-init"></a>init - `enyo init`

```bash
Usage: enyo init [project] [options]

project     The full or relative path to the target project. Defaults to the current working directory if not provided.

Options:
   --user                 Set this to false when executing from an automated script or in an environment where a user-environment should not be used.  [true]
   -l, --log-level        Typically only used for debugging purposes. Available options are [fatal, error, warn, info, debug, trace]. Defaults to "warn".  [warn]
   -v, --version          Display the current version of the tools and exit.
   -n, --name             The name of the project. If not provided, the "project" basename will be used instead.
   -t, --template         The name of the template a new project should be initialized from. See the "templates" command for more information on how to manage templates. If no template is specified and the "project" is not already a project the default template will be used.
   --library              Set this flag when initializing a library project. This is assumed if the requested "template" is a library. If this flag is set and the requested template is not a library it will ignore the flag.
   -i, --init-libs        If the project has any library dependencies and this flag is set it will attempt to intialize them. Set this to false to skip this step.  [true]
   -L, --link-all-libs    If this flag is set it will attempt to link any required libraries and skip those that are not linkable. If the "init-libs" flag is set to false this has no meaning.  [false]
   -D, --link-available   If this flag is set it will attempt to link any required libraries and install those that are not linkable. If the "init-libs" flag is set to false this has no meaning. This option will be ignored if the "link-all-libs" flag is set.  [false]

Initialize a new or existing Enyo library or application. You can initialize new projects from a template and/or ensure the required (Enyo) dependencies are installed.
```

The `enyo init` command is designed to aid in managing the dependencies and initialization of new or current projects. It relies on templates to know which files to generate for new projects and it uses the `package.json` and `.enyoconig` configuration files to know the name of the project and other information such as whether or not it is a _library_ or an _application_ and what dependencies it may need.

Here are some other examples of using the command:

```bash
# begin a new project
enyo init my-new-project

# initialize an existing project in the current working directory
enyo init

# to initialize a project as a library as opposed to an application
# use the --library flag
enyo init --library
```


#### <a name="commands-link"></a>link - `enyo link`

```bash
Usage: enyo link [target] [options]

target     If linking a library into the current project, this is the name of the library to link. If omitted the current library will be made linkable to other projects. This can also be a comma-separated list of libraries to link into the current project.

Options:
   --user                Set this to false when executing from an automated script or in an environment where a user-environment should not be used.  [true]
   -l, --log-level       Typically only used for debugging purposes. Available options are [fatal, error, warn, info, debug, trace]. Defaults to "warn".  [warn]
   -v, --version         Display the current version of the tools and exit.
   -r, --list-local      Print a list of the libraries already linked in the current project. If "target" is provided with this flag it will attempt to print links from the project at that location.  [false]
   -L, --list-linkable   Print a list of the linkable libraries known on the system.  [false]
   --force               Forces a link to be made regardless of whether or not the dependency already exists. This should be used with caution as it may overwrite an existing local repository. All local changes in the repository would be lost.  [false]

Manage linkable libraries. Make the current library linkable or add a linkable library as a dependency of the current project. List known linkable libraries and their real locations or linked libraries of the current project. This command is not available in non-user mode.```

The `enyo link` command can be used to link an existing, linkable library into your current project or to make your current library linkable to other projects. This is very useful when you are modifying a library you already have locally and you do not want multiple copies.

Make sure you checkout [enyo unlink](#commands-unlink) for additional resources related to linking libraries on your system.

```bash
# we want to link the enyo framework/library into a new project
# so we ensure it is linkable on our system
cd enyo
enyo link
cd ../
enyo init my-new-project
cd my-new-project
enyo link enyo

# to get a list of the linked libraries in the current project simply
enyo link -r

# to see all of the linkable libraries on your system
enyo link -L

# if you had a cloned copy you can force it to create the link anyway
enyo link --force enyo

# you can also link multiple libraries at the same time
enyo link enyo,moonstone,enyo-webos
```

#### <a name="commands-unlink"></a>unlink `enyo unlink`

```bash
Usage: enyo unlink [target] [project] [options]

target      The name of the library to unlink. If in a project and no other flags specified, will attempt to unlink the library from the current project. If specifying a project that is not the current working directory use the "project" parameter. To unlink multiple libraries from the same project or from the system this parameter should be a comma-separated list of names. If using the "unlink-all" flag this property behaves like the "project" parameter unless the "global" flag is set, in which case it will be ignored.
project     The path to the project form which to unlink the "target" library/libraries. Defaults to the current working directory. When using the "global" flag this parameter is ignored.

Options:
   --user             Set this to false when executing from an automated script or in an environment where a user-environment should not be used.  [true]
   -l, --log-level    Typically only used for debugging purposes. Available options are [fatal, error, warn, info, debug, trace]. Defaults to "warn".  [warn]
   -v, --version      Display the current version of the tools and exit.
   -U, --unlink-all   Instead of removing one or a few libraries from the project or system, unlink them all. When using this flag the "target" parameter behaves like the "project" parameter unless the "global" flag is set.
   -g, --global       Set this to target system links. Will ignore pathing parameters when this flag is set.

Unlink a library from the current project or the system or, if the current working directory is a library, make it unlinkable on the system.
```

The `enyo unlink` command is designed to work in-tandem with the [enyo link](#commands-link) command to make managing linkable libraries easier. With `enyo unlink` you can unlink one or more linked libraries from your current project or remove libraries from your linkable libraries stash.

```bash
# to unlink one or more libraries from your current project
enyo unlink enyo
enyo unlink enyo,moonstone

# to remove a linkable library from your environment
enyo unlink -g enyo,layout

# to unlink all linked libraries in your current project
enyo unlink --unlink-all
enyo unlink -U

# or to remove all linkable libraries in your environment
enyo unlink -g --unlink-all
enyo unlink -g -U
```

###<a name="commands-templates"></a>templates `enyo templates`

```bash
Usage: enyo templates [action] [target] [options]

action     This is one of "add", "remove", "list", "install" or "default". The action must be provided and all actions require a "target" except the "list" action. The "add" action takes a local directory you have setup as a template and creates a symbolic link internally so you can select it by name (or set as the default) and it will update as you make changes to your development directory. The "install" action will retrieve a remote URI and install it locally for selection. The "remove" action will remove either the symbolic link or copy of an installed template by name. The "list" command will print a list of available templates denoting the current default template with an asterisk (*). The "default" action allows you to set the default template of the system by name. Using the "default" action with no "target" will remove any default.
target     When adding a template this is the full or relative path to the template installer. When removing a template this is the name of the installed template. When setting a default template this is the name of the installed template. When installing a template this is the URI of the remote template to fetch and install.

Options:
   --user            Set this to false when executing from an automated script or in an environment where a user-environment should not be used.  [true]
   -l, --log-level   Typically only used for debugging purposes. Available options are [fatal, error, warn, info, debug, trace]. Defaults to "warn".
   -v, --version     Display the current version of the tools and exit.

List, add, remove and change the default templates for the current user. This command cannot be used in non-user mode.
```

This command is a simple utility to allow you to list available templates, add a template from a local directory, or install a template from a
remote github repository. For templates that can be installed via `npm` simply install the npm module wherever you would like then run the "add" action of the command `enyo templates add {path/to/your/module}`, the same as you would any other local template you may have.

Note that all templates must have a `package.json` and `.enyoconfig` file and while either of these files may contain the _name_ property it is preferred to set the _name_ in the `package.json`.

When using the [enyo init](#commands-init) command, using the `-t` option and specifying a name will allow you to select which template to use when initializing a new project from scratch. If the `.enyoconfig` contains any dependent libraries they will be initialized. If you need others you can then safely modify the `.enyoconfig` file and rerun `enyo init` without the `-t` flag.

```bash
# you can list available templates
# the default template has a '*' next to its name
enyo templates list

# you can set a default template (by name)
enyo templates default my-template

# you can remove the default template by not declaring a name
enyo templates default

# you can add your own directory as a template
enyo templates add #assumes current working directory
enyo templates add path/to/template

# you can install a remote template
enyo templates install https://github.com/enyojs/moonstone-template.git
```

### <a name="commands-pack"></a> pack `enyo pack`

```bash
Usage: enyo pack [package] [options]

package     The path to the package to bundle and prepare for deployment. This can be a relative or full path. If omitted the current working directory will be used.

Options:
   --user                                     Set this to false when executing from an automated script or in an environment where a user-environment should not be used.  [true]
   -l, --log-level                            Typically only used for debugging purposes. Available options are [fatal, error, warn, info, debug, trace]. Defaults to "warn".  [warn]
   --log-json                                 Enable this flag to ensure the output of the logging is the normal bunayn "JSON" format to STDOUT that can be piped to their separate bunyan cli tool for filtering.  [false]
   -v, --version                              Display the current version of the tools and exit.
   --name                                     In rare cases you may wish to override the current project's configured "name". If so set this value to modify the output "name". NOTE: this is not the same as the "title" of the HTML (if applicable) that is produced. See "--title" for more information. This value must be a valid POSIX filename.
   -P, --production                           Build in production mode; supersedes the --dev-mode and --no-dev-mode flags. Defaults to false.
   -D, --dev-mode                             Whether or not this build is a development build; negated if --production set. Defaults to true.
   --cache                                    Enables the use of a cache-file, if it exists and also the ability to write to the cache-file. This cache-file can significantly improve build times in some cases. To force a clean build but cache the results simply remove the cache-file. To disable use --no-cache. Defaults to true.
   -r, --reset-cache                          Allows you to ignore an existing cache-file but still write the cached output for subsequent runs. Defaults to false. The same as removing the current cache-file.
   --trust-cache                              Convenience flag only used during watch-mode, when set, will default to using the cached data without re-building the output. This should only be used when you are certain nothing has changed and it has no need to re-evaluate the input source or re-produce any of the output files. Defaults to false.
   --clean                                    This will empty the outdir before writing any new files to it. Helpful when switching build modes or when assets/styles have changed and old files may be lingering. Defaults to false.
   --source-maps                              Whether or not to build source-maps when in --dev-mode; disable with --no-source-maps. Defaults to true (only applies to --dev-mode).
   --paths                                    A command separated list of paths to search for libraries and their modules. Specifying these from the command-line will override any found in the configuration files. NOTE: the paths in the configuration file are relative to the package location but paths interpreted from the command-line should be relative to the current working directory (unless full). Also NOTE: the packager will still search the value of the "libDir" of when any additional paths have been exhausted.
   --externals                                To build without bundled external libraries, use --no-externals; always false when in --library mode. NOTE: the library is still required to compile even if the output will not include it. Defaults to true.
   --strict                                   By default, if a style-file or asset file is missing, or if an asset path cannot be properly translated, only a warning will be issued. If this is true then it will halt the compilation. Defaults to false.
   --skip                                     A comma-separated list of external libraries that should not be included in the output when not in --library mode.

		Example: --skip=enyo,moonstone

   --library                                  Produce a library build instead of a packaged application build from the designated package and entry file; will ignore the --template-index flag. Defaults to false.
   --include-wip                              By default when building a library it will ignore modules with the string "wip" in the filename (for single-file modules) or if the "wip" property in the package.json is true. If you would like to include WIP modules set this to true or remove those properties. Defaults to false.
   --title                                    To set the <title/> of the output project index if not in --library mode. Usually set in the configuration so it will consistently build with the same title. If not specified here or in the configuration will default to the name of the project.
   -d, --outDir                               Where to place the output files, this value is relative to the current working directory. If the value is provided by the configuration file it will be relative to the package location. Defaults to "./dist"
   -o, --outFile                              The output filename for the compiled application HTML when not in --library mode. Defaults to "index.html".
   -L, --less-plugin                          Specify a plugin that should be used when compiling Less. These are specified using subarg notation from the command-line with the first argument the name of the plugin that can be required by the build-tools followed by any arguments to be parsed and passed to the plugin at runtime. This option can be submitted multiple times. It can be configured in the configuration file as an array of objects with a "name" and "options" properties where the "options" property is an object of key-value options to be passed to the plugin. If specified from the command-line it will supersede any values from the configuration file.

		Example: -L [ resolution-independence --riUnit=px ]

   -Z, --asset-root                           If specific libraries will be included statically (not included in the build) and will not be included in the default location alongside the application sources use this to specify the roots separately for paths using the @@LIBRARY notation. Use the reserved character "*" to indicate that all libraries should use the provided root if not specified. These can be configured in the configuration file as an array of objects with a "name" (the library) and "path" (the prefix).

		Example: -Z moonstone=/opt/share/assets/ -Z enyo=/opt/share/frameworks/
		Example: -Z *=/opt/share/ -Z moonstone=/opt/share/assets/
   --less-only-less                           To ensure that only less files are passed through to the less compiler set this flag to true. Normally all CSS/style is passed through for sanity and consistency. Use this option sparingly. Defaults to false.
   --less-var                                 Add a less variable to the end of all concatenated Less before compilation. Less evaluates all of its variables before processing meaning the last definition of a variable will be used. This can be specified as many times as is necessary in the form of --less-var=@NAME:VALUE. Remember that the value will be used as-is so wrap it with quotes if it is a string (e.g. --less-var=@lessvar:'string') [.enyoconfig option "lessVars" - ARRAY - objects with name and value properties].
   --minify-css                               Usually minification only occurs during a production build but you can set this flag to true to minify even in development builds. Defaults to false
   -c, --inline-css                           Only used in production mode, whether or not to produce an output CSS file or inline CSS into the index.html file; turn off with --no-inline-css. Defaults to true.
   --css-outfile                              Only used in production mode, the name of the output CSS file if --no-inline-css. Defaults to "output.css"
   --js-outfile                               Only used in production mode, the name of the output JavaScript file if --no-inline-js. Defaults to "output.js"
   -j, --inline-js                            Only used in production mode, whether or not to produce an output JS file or inline JavaScript into the index.html file; turn off with --no-inline-js. Defaults to true.
   -t, --template-index                       Instead of using the auto-generated HTML index, start from this file. Can be configured but does not have a specified default value.
   -W, --watch                                Will build the output and continue to monitor the filesystem for changes to the source files and automatically update the build. Defaults to false.
   --polling                                  When using the --watch command, this will force the watcher to use filesystem polling instead of native (and more efficient) FSEvents. Only use this is you are having an issue with the number of files being watched or are using a network filesystem mount -- WARNING -- it will SIGNIFICANTLY reduce performance. Defaults to false.
   -I INTERVAL, --polling-interval INTERVAL   When using the --polling flag, set this to the time in milliseconds to poll the filesystem for changes. Has no effect if --polling is not set. Defaults to "100".
   --head-scripts                             A comma-separated list of paths relative to the current working directory of ordered JavaScript files to arbitrarily add at the beginning of all JavaScript source. In development mode these files will be loaded separately while in production they will be inlined unless the --no-inline-js flag is used. Without strict mode enabled, warnings will be issued when named files cannot be resolved. This option has no meaning in library mode [.enyoconfig option "headScripts" - ARRAY - relative paths to project].
   --tail-scripts                             A comma-separated list of paths relative to the current working directory of ordered JavaScript files to arbitrarily add at the end of all JavaScript source. In development mode these files will be loaded separately while in production they will be inlined unless the --no-inline-js flag is used. Without strict mode enabled, warnings will be issued when named files cannot be resolved. This option has no meaning in library mode [.enyoconfig option "tailScripts" - ARRAY - relative paths to project].
   --promise-polyfill                         When using the request feature for asynchronous loading the platform needs to have support for Promises. If the target platform does not support Promises or to ensure that the application can support platforms that do not have Promise support set this flag to true [.enyoconfig option "promisePolyfill" - BOOLEAN - false].
   --style-only                               Set this flag to only output final style files. All other settings apply normally [.enyoconfig option "styleOnly" - BOOLEAN - false].

Package an Enyo application or library for use in a browser.
```

The `enyo pack` command will build your application (or in some cases, library). Using the available configuration options you can build your application with a great deal of freedom.

In most cases the command-line flag's own description should suffice as a description. More detail will be coming with a guide to developing with the new build tools and ideology behind it that makes it work.

Here are a few basic examples:

```bash
# generic build
enyo pack

# output to a non-default (dist) directory
enyo pack -d ../build

# build in production mode
enyo pack -P

# build in production mode with JavaScript and style output in
# separate files instead of inlined in the output index.html
enyo pack -P --no-inline-css --no-inline-js

# build but have a non-default output html file (instead of index.html)
enyo pack -o build.html

# if including a library at runtime, so it should not include the source
# in the build, you can exclude that library like so
enyo pack --skip=enyo,moonstone
# or to do this for ALL libraries simply
enyo pack --no-externals

# to have the compiler automatically re-execute on source changes
# use the --watch flag
enyo pack --watch

# to ensure that all output from the current build is the only output
# with no extraneous files from previous runs
enyo pack --clean
```

#### <a name="commands-pack-auto-rebuild"></a>Automatic rebuilding using `--watch`

When using `enyo pack` you can also use the `--watch` flag which begins a non-terminating process that will detect changes to your source and rebuild automatically. There are additional, relevant options `--polling` and `--polling-interval` (just `-I` for short).

> On some Windows machines, older Linux machines or when using a mounted network filesystem it _may_ be necessary to set
> the `--polling` flag. It is not advised to use the polling feature unless necessary, however, because it is CPU
> intensive. The `--polling-interval` flag accepts an integer representing how often, in milliseconds, to poll the
> system for changes.

For more details on how the filesystem monitor works, see [chokidar](https://github.com/paulmillr/chokidar).

It is very useful to use a more verbose logging level with the _watcher_ to observe more details and events as they occur. However, when enabling the logger utility you may get more information than you desire (all components share the same logging stream). Here is an example showing only the output from the _watcher_ component (this assumes you have _bunyan_ installed globally via `npm install -g bunyan`).

```bash
# the keys here are the -l, --log-json and the -c flag and filter string
# passed to the bunyan process
enyo pack -l info --log-json --watch | bunyan -o short -c 'this.component == "watcher"'
```

> It should be noted that _info_ is really just the minimum verbosity for the _watcher_ component and if need be
> or to see more details you can increase this with _debug_ or _trace_ respectively.

##### <a name="commands-pack-errors"></a>Error handling/debugging

Error reporting by the `enyo pack` command are handled via a dependency called [bunyan](https://github.com/trentm/node-bunyan). Using the `-l debug` (for example) would output a lot of information so use sparingly.

#### <a name="assets"></a>Asset Handling

Assets come in many forms and are included by applications in many different ways. In an attempt to support the necessary possibilities while also maintaining simplicity several techniques have been provided.

* [How to include Assets](#assets-how-to-include-assets)
* [Referencing from style](#assets-referencing-from-style)
	* [warning](#assets-referencing-from-style-warning)
* [Referencing from JavaScript](#assets-referencing-from-javascript)
* [How it works](#assets-how-it-works)
	* [conventions](#assets-conventions)

##### <a name="assets-how-to-include-assets"></a>How to include assets

Assets can be included from any module's _package.json_ file. There are 2 properties associated with assets: `assets` and `devAssets`. Both are _ordered arrays of relative paths or relative [globs](https://github.com/isaacs/node-glob#glob)_. The `assets` property, if present, will be used _in every build_ of the project whereas the `devAssets` property, if present, will only be used in [dev-mode](#options-dev-mode). The ability to _sometimes_ include assets during development is handy for using mock-data or providing some files for development that would, in production, be provided by some other means.

For example,

```bash
{
  "main": "index.js",
  "assets": [
    "assets/*.png",
    "fonts/**/*.ttf"
  ],
  "devAssets": [
    "data/mock.json" 
  ]
}
```

##### <a name="assets-reference-from-style"></a>Referencing from style

Static URI's are automatically updated to work as long as they are relative from the file including them. **The @import statement is highly discouraged in favor of entering the file in the package.json file but the paths are updated correctly if they are encountered.**

For example, if in your code you have (see the [How it works](#assets-how-it-works) section).

```css
.class {
	url('../assets/icon.png');
}
```

it will be correctly re-written to the output path of that asset (assuming it was correctly included by the _package.json_ file)

```css
.class {
	url('src/module/assets/icon.png');
}
```

##### <a name="assets-referencing-from-style-warning"></a>Warning

While it is safe to include a [Less variable](http://lesscss.org/features/#variables-feature) within a relative path, URI's in general **should not** be stored in variables as they will run into mapping issues. If the [conventions](#assets-conventions) are followed the need for variables storing URI's should diminish completely.

For example,

```less

@iconfilepath: '../assets/';
@icon: 'icon.png';

.class {
	// valid use case
	url('../assets/@{icon}');
	// invalid use-case because @iconfilepath won't be evaluated
	// until too late
	url('@{iconfilepath}/icon.png');
}
```
In cases where, previously, it would have been useful to store a relative path in a [Less variable](http://lesscss.org/features/#variables-feature) to share it with other projects it can be replaced by simply following the [conventions](#assets-conventions).


And for the (**discouraged**) @import statement, the packager will convert the (relative) URI to a full-path URI when using the [Less Compiler](http://lesscss.org/) so it can correctly import the file even though its input is a concatenated string of other files:

```css
@import './less.less';
```

would become

```css
@import '/Users/user/projects/project/src/module/style/less.less';
```

##### <a name="assets-referencing-from-javascript"></a>Referencing from JavaScript

There are plenty of cases where a static reference to an asset may be stored in the JavaScript and later used to, say, loading/swap an image (or any other thing one might need that for). Just like with when [referencing a URI from style](#assets-reference-from-style) the JavaScript URI must be relative to the file from which it is declared. For the packager to automatically expand these relative paths you must use a special token (@) to flag your string.

For example, you could do something like this (see [How it works](#assets-how-it-works) below for file location)

```javascript
var img = document.getElementsByTagName('img')[0];
img.src = '@../assets/icon.png';
```

and this would be expanded correctly to

```javascript
var img = document.getElementsByTagName('img')[0];
img.src = 'src/module/assets/icon.png';
```

in the `project.js` output file.

> It should be noted that in cases where dynamic paths are created at runtime you must rely on the [conventions](#assets-conventions) as mapped out below to achieve the desired outcome. **There is no dynamic, run-time map from which these paths can be arbitrarily derived.**

##### <a name="assets-how-it-works"></a>How it works

<a name="assets-conventions"></a>Keep these simple conventions in mind when dealing with assets paths in your source:

- Always use relative paths from the current source file (JavaScript or CSS/Less) so the packager can effectively map the paths for you
- The destination for an asset is a fixed convention, meaning, you can count on it doing the same thing, every time
- For an asset from your own source, it will be the actual path from the project root
- For an asset from an included library, it will be the actual path _from the library root_ preceeded by the _library name_
- These conventions are in place to ensure there are no filename collisions in the output by ensuring uniqueness

For example, if you have a project with the following structure

```
project/
  lib/
    ui-library/
      assets/
        icon.png
  src/
    module/
      assets/
        icon.png
      style/
        style.css
      index.js
```

and assuming the default output directory of `dist` these assets would be packaged in the following locations (within the output directory)

```
dist/
  // notice the library asset is from the library root
  ui-library/
    assets/
      icon.png
  // notice the actual path from the project root to the asset
  src/
    module/
      assets/
        icon.png
  // notice how the style from src/module/style/style.css is now in
  // project.css file and the URI was correctly updated to point to
  // src/module/assets/icon.png even though it was originally relative
  project.css
  project.js
```

So, simply put, an asset in an included library as named above:

`lib/ui-library/assets/icon.png` _could_ be referenced as `ui-library/assets/icon.png`

and

`src/module/assets/icon.png` _could_ (but shouldn't) be referenced as `src/module/assets/icon.png`



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
