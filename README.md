## Enyo Developer Tools
> version 0.5.3

> __SPECIAL NOTICE__
> 
> There have been breaking changes in the configurations and environment setup between
> versions `0.5.0` and `0.5.3`. The new environment structure is fully explained 
> in the documentation below and with notes in [CHANGES.md](CHANGES.md). It is 
> __highly recommended__ that you re-run `enyo init` in all of your working 
> projects as it will upgrade your local configuration to the current standard 
> structure. Ensure that you read about each of the available commands and see 
> the examples for better usage.


# Contents

* [Description](#description)
* [Setup](#setup)
	* [Requirements](#setup-reqs)
	* [Installation](#setup-install)
		* ~~[NPM installation](#setup-npm)~~
		* [Manual installation](#setup-manual)
			* [Clean](#setup-manual-clean)
			* [Upgrade](#setup-manual-upgrade)
* [Environment Configuration](#env)
	* [User](#env-user)
		* [User-level configuration](#env-user-user)
		* [Project default configuration](#env-user-project)
		* [Links directory](#env-user-links)
	* [Script/Server](#env-script)
	* [Project](#env-project)
* [Commands](#commands)
	* [config](#commands-config)
	* [init](#commands-init)
	* [link](#commands-link)
	* [unlink](#commands-unlink)
	* [find-links](#commands-find-links)
	* [pack](#commands-pack)
		* [Error handling/debugging](#commands-pack-errors)
	* [server](#commands-serve)
* [Asset Handling](#assets)
	* [How to include assets](#assets-how-to-include-assets)
	* [Referencing from style](#assets-referencing-from-style)
		* [Warning](#assets-referencing-from-style-warning)
	* [Referencing from JavaScript](#assets-referencing-from-javascript)
	* [How it works](#assets-how-it-works)
		* [conventions](#assets-conventions)

### <a name="description"></a>Description

The Enyo dev-tools module is a collection of tools designed to aid in building applications using current Web Standards and technologies. If following the designed conventions along with the tools it can significantly reduce the amount of generated source your applications require to function while also allowing you to build your assets and resources around your JavaScript dependency hierarchy.

### <a name="setup"></a>Setup

#### <a name="setup-reqs"></a>Requirements

In order to use these tools you need to ensure you have Node version `0.12.2` or higher. You can acquire [Node](https://nodejs.org/download/) in various ways including their pre-built binary or installation packages. Ensure that the correct version of Node and npm are available from the terminal/console of your operating system and that you have the correct permissions to install _npm packages globally_. You can check your current version of Node by issuing the following command:

```bash
node --version
```

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
git checkout 0.5.3
npm install
npm link
```

###### <a name="setup-manual-upgrade"></a>Upgrade

If you already have a local clone of _enyo-dev_ and need to upgrade follow these instructions from the root of the local repository:

```bash
git pull
# if there is a version, use the next line and replace the version as appropriate
git checkout 0.5.3
npm install
npm prune
npm link
```

### <a name="env"></a>Environment Configuration

#### <a name="env-user"></a>User (normal use-case)

By default, the enyo developer tools need a location to store stateful information. For a typical user a directory `.enyo` will be created at the root level of the user's _home_ (differs per operating system - the equivalent of `~/` for OS X and Linux and `$HOME` for most Windows systems). It will create and store information in various files as needed. There are a few files which you can modify directly or via the `enyo config` command (explained below) to automatically modify the behavior of the tools according to your needs.

##### <a name="env-user-user"></a>User-level configuration file `~/.enyo/config`

The user-level configuration file is a JSON file at `~/.enyo/config` that will be referenced for values when a local configuration file doesn't exist or to specify common configuration options that would otherwise need to be specified each time a command is issued. Initially this file is generated for you with all of the most common defaults. You can update it to suit your needs either manually or by using the `enyo config` command as discussed later. At this time there are only a few options useful in this configuration (comments added for clarity).

```javascript
{
  // a few commands have an interactive mode that can be helpful in deciding how to
  // handle various situations, if you turn this off it will be forced to use
  // default options, only use if you know what you are doing, in script-safe mode it is
  // forced to false regardless of this value
  "interactive": true,
  
  // this is useful when using automated scripts in server-like environments to run commands
  // it avoids a lot of user-level configuration and setup that does not need to be present
  "scriptSafe": false
}
```

##### <a name="env-user-project"></a>Project default configuration file `~/.enyo/defaults`

The project defaults configuration file is a JSON file at `~/.enyo/defaults` that is used (directly copied) as a _new_ project's own configuration file (`[project]/.enyoconfig`). Any values in this file will be evaluated and used when initializing a new project using `enyo init` that does not directly specify a command line flag that negates one of its values or is using the `--bare` flag (meaning the project `[project]/.enyoconfig` will be empty). For a more complete understanding of what `enyo init` can do, read its documentation below. Rememeber that once using `enyo init` any of these options can be updated/modified for that project only by using the `enyo config` command in the project directory or by directly editing the project's `[project]/.enyoconfig` file. The default options in this file are as follows (comments added for clarity).

```javascript
{
  // the directory within the project where it should install included libraries
  "libDir": "lib",
  
  // the list of default libraries to be included in the project's "libDir"
  "libraries": [
    "enyo",
    "layout",
    "canvas",
    "svg",
    "moonstone",
    "onyx",
    "spotlight",
    "enyo-webos",
    "enyo-ilib"
  ],
  
  // a map of library names to their location from where they can be retrieved
  "sources": {
    "enyo": "https://github.com/enyojs/enyo.git",
    "layout": "https://github.com/enyojs/layout.git",
    "canvas": "https://github.com/enyojs/canvas.git",
    "svg": "https://github.com/enyojs/svg.git",
    "moonstone": "https://github.com/enyojs/moonstone.git",
    "onyx": "https://github.com/enyojs/onyx.git",
    "spotlight": "https://github.com/enyojs/spotlight.git",
    "enyo-webos": "https://github.com/enyojs/enyo-webos.git",
    "enyo-ilib": "https://github.com/enyojs/enyo-ilib.git"
  },
  
  // a map of library names to the intended target if it is not "master" and can
  // be a branch, tag or specific commit hash - if not present will be assumed as
  // "master"
  "targets": {
    "enyo": "2.6.0-dev",
    "layout": "2.6.0-dev",
    "canvas": "2.6.0-dev",
    "svg": "master",
    "moonstone": "2.6.0-dev",
    "onyx": "2.6.0-dev",
    "spotlight": "2.6.0-dev",
    "enyo-webos": "2.6.0-dev",
    "enyo-ilib": "2.6.0-dev"
  },
  
  // a list of libraries to include in the project as a link instead of a copy of
  // the repository
  "links": [],
  
  // set this to true to always link the libraries in projects
  "linkAllLibs": false,
  
  // the default log-level for output produced by the build tools
  "logLevel": "warn",
  
  // whether or not to build in production mode
  "production": false,
  
  // whether or not to build in developer mode, production mode supersedes this value
  "devMode": true,
  
  // whether or not to read/write from a cache file to speed up builds
  "cache": true,
  
  // write a new cache file but ignore the current file
  "resetCache": false,
  
  // used for --watch mode and when using enyo serve, if you have already built, this will
  // cause the server/system to startup almost instantly (as long as the cache is valid)
  "trustCache": false,
  
  // the name of the cache file to read/write from/to
  "cacheFile": ".enyocache",
  
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
  "outdir": "./dist",
  
  // when not in library mode, the name of the output HTML file
  "outfile": "index.html",
  
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
  
  // additional paths to watch instead of just the application/local source, can be costly on some
  // systems that don't support native filesystem events
  "watchPaths": [],
  
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

##### <a name="env-user-links"></a>Links directory `~/.enyo/links`

When using the _links_ option within your projects the tools will create a separate directory at `~/.enyo/links` where it stores the global link to your local libraries. Subsequent requests in projects will link to _this location_ so you can modify the location of your library without invalidating all of the projects that may be linked to it. For more information on using _links_ in your development environment see the documentation below.


#### <a name="env-script"></a>Scripts/Servers

Often when using the development tools it is necessary to run non-interactive commands and avoid unnecessary environment setup that will be reset on each subsequent run. Please use the `--script-safe` flag for any command issued to disable interactive mode and keep from generating user-level configuration files. This also ensures that separate commands can safely be executed in parallel (multiple jobs) without race-conditions.

#### <a name="env-project"></a>Project

A project's configuration is determined by properties found in the `.enyoconfig` configuration file and the `package.json` file. Both files consist of JSON with specific properties. The available properties for the `.enyoconfig` file are those posted for the [defaults](#env-user-project). The properties found in the `package.json` file are special because they are _directly related to the package they define_.

The actual specification for a `package.json` file are part of the [CommonJS Specification for packages](http://wiki.commonjs.org/wiki/Packages/1.1). The options we add are a superset of options that can be defined for _any package_ in your project's and libraries. This is why they are defined in the `package.json` and not in the `.enyoconfig` file. Here are the additional properties we support in the `package.json` file:

```bash
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

### <a name="commands"></a>Commands

All of the tools require various commands issued from the command-line. Below are a list of the available commands, their options and some typical use-case examples. The root `enyo` command is, by itself, not very useful (literally, does nothing). The sub-commands are where the magic happens. All boolean flags can be negated by using the full flag prefixed with `no` (e.g. `--interactive` can be negated by using `--no-interactive` or optionally `--interactive=false` or even `-i false`). It should be noted that each sub-command shares these command-line flags:

```bash
-c, --config-file
-i, --interactive
--script-safe
-v, --version
```

The `-c, --config-file` option is a relative path to a custom configuration file (the default is `.enyoconfig`). Note that, if the file doesn't exist it will be ignored and the command will continue using the defaults and user-level configurations.

The `-i, --interactive` option is a boolean indicating whether any given option should enter interactive-mode (if necessary) to receive user input to resolve a course of action that has multiple paths. If interactive mode is disabled it will fall back to a default path that varies by the command.

The `--script-safe` option is a boolean indicating that the requested command should be executed in a manner that is safe for scripts and server environments. See [Scripts/Servers](#env-script) for more information.

The `-v, --version` option simply prints the current version of the tools and exits.

#### <a name="commands-config"></a>config - `enyo config`

```bash
Usage: enyo config [target] [value] [options]

target     The configuration property to retrieve, set or remove. When the --global flag is set will update the user-level configuration file unless target begins with default.[target] in which case it will update the project defaults configuration.
value      The value(s) to add/set to target. If an array, can be a comma-separated list of values to add/remove.

Options:
   -c, --config-file   Set this to a custom configuration file, otherwise defaults to .enyoconfig in the target working directory.
   -i, --interactive   Various commands may need user input. To avoid interactive sessions and always use the built-in resolution options set this to false.
   --script-safe       When executing commands within an automated script or without an active terminal set this flag to true.
   -g, --global        Execute the current operation on the global configuration.
   --get               Retrieve the target as it would be resolved by a command from the current configuration file (global only if the --global flag is set).
   --set               Set the target to the value. If target is an array the value will be added to the array if it does not exist. If the target is an array or the --array flag is set and the value is a comma-separated list of values, they will all be added to the array if they do not already exist. Set the --global flag to update the global configuration or defaults. This is implied if value exists. If no value exists the target will be removed entirely. NOTE you cannot set an object directly, only properties of an object.
   -a, --array         Add or remove the current value(s) from a configuration array. If the target already exists in the configuration and is an array, this is implied.
   -r, --remove        Remove the target from an array or, if not an array, remove the option altogether.
   --reset             If a target is provided, will reset the project configuration target to the current user-level default value. If the --global flag is set and target is provided it will reset the appropriate user-level configuration to the system default value. If no target is provided the project configuration will be reset to the current user-level configuration defaults. If the --global flag is set and no target is provided it will reset the user-level configuration file and defaults to system defaults. CANNOT BE UNDONE.

Update, remove or set configuration options for your project or environment.
```

The `enyo config` command is a convenience method designed to make modifying your configurations as easy as possible. Anything you can do with this command you can also do by editing the target JSON file directly. If issued in a directory that _seems like an enyo project_ (has a valid package.json file) it will assume you intend to modify a local configuration file (`.enyoconfig` unless otherwise specified). You can update the [user-level configurations](#env-user) instead by using the `-g, --global` flag and the appropriate target. To update the user-level configuration simply use the `-g, --global` flag and the target option. To update the project-defaults prefix all options with `defaults.[option]` where `[option]` is the default option you wish to set, update or remove.

Note that updating default values in the user-level configuration will not automatically update existing configurations.

~~Note when adding _libraries_ using the `enyo config -a defaults.libraries` or `enyo config -a libraries` (or other equivalent) commands they can have their source and target set/updated at the same time using the form `[lib]@[remote]#[target]` (e.g. `enyo@https://github.com/enyojs/enyo.git#2.6.0-dev`). __Do not use this method of adding the source and target if the GIT URI includes any commas__. Also note you can use the ssh+git formats as well e.g. `enyo@git@github.com:enyojs/enyo.git#master` is still valid.~~

Note when using the `-r, --remove` flag and the `libraries` or `defaults.libraries` target it will also remove the related `sources` and `targets` entry when applicable.

Examples:

```bash
# retrieve the list of libraries that would be installed if you run enyo init
# note that --get is implied and can be left off of the command
enyo config --get libraries

# retrieve the list of default libraries from the global configuration
enyo config --get -g defaults.libraries

# retrieve the global interactive mode setting
enyo config -g interactive

# update the global interactive mode setting
enyo config -g interactive false

# add some libraries to the libraries list for the given project
enyo config -a libraries enyo,moonstone,enyo-webos

# update the source for the enyo library in the current project
enyo config sources.enyo git@github.com:enyojs/enyo.git

# update the target for the enyo library in the current project
enyo config targets.enyo my-test-branch

# remove some libraries from the libraries list
enyo config -a -r libraries enyo-cordova,canvas

# update the global libDir value for projects
enyo config -g defaults.libDir libs
```

#### <a name="commands-init"></a>init - `enyo init`

```bash
Usage: enyo init [project] [options]

project     The relative path to the project to initialize. Defaults to the current working directory. If the project directory does not exist it will be created.

Options:
   -c, --config-file   Set this to a custom configuration file, otherwise defaults to .enyoconfig in the target working directory.
   -i, --interactive   Various commands may need user input. To avoid interactive sessions and always use the built-in resolution options set this to false.
   --script-safe       When executing commands within an automated script or without an active terminal set this flag to true.
   --name              This is the name of the project for the project-level configuration. If not provided and a package.json exists then it will use its "name" value. If not provided and neither a package.json or project-level configuration exists it will default to using the directory name.
   --title             This is the title that will be applied to the project-level configuration and ultimately used when packaging (if the project is not a library).
   --package           By default this will initialize a package.json file. If this is not desired set this to false with --no-package.  [true]
   --config            By default this will initialize a .enyoconfig file. If this is not desired set this to false with --no-config.  [true]
   --git-ignore        By default this will initialize or update a .gitignore file. If this is not desired set this to false with --no-git-ignore.  [true]
   --dependencies      To initialize the repository but without initializing any dependencies set this flag to false with --no-dependencies.  [true]
   -L, --libraries     Only initialize this comma-separated list of library names. If the --save option is set will save this value as the project's only libraries.
   --links             A comma-separated list of specific libraries to install as a linked library. If provided, these links will be merged with any existing directives from the configuration unless the --save flag is set in which case it will replace any existing values and be stored. If a link is specified but already exists and is not a link it will be replaced by the link - LOCAL CHANGES WILL BE LOST AND ARE UNRECOVERABLE. To avoid this behavior, use the --safe flag.
   --link-all-libs     Set this to link from the linkable libraries instead of installing a local repository for each. If a library already exists and is not a link it will be replaced by the link - LOCAL CHANGES WILL BE LOST AND ARE UNRECOVERABLE. To avoid this behavior, use the --safe flag. If the --save flag is set, this option will be set to true in the project-level configuration.
   --save              Set this flag to save specified options for the libraries, links and link-all-libs command options.
   --safe              Set this flag to ensure that links for existing directories will not replace the existing library and potentially lose local changes.
   --library           When initializing a library use this flag so that it will not attempt to apply normal project defaults such as dependencies or other unnecessary options.
   --reset             Convenience flag to use to reset your project-level configuration when initializing. This will only reset your .enyoconfig, not your .gitignore or package.json files. Resetting your project configuration will start from your current defaults settings. This option is ignored if --no-config is set.

Initialize a new or existing Enyo project to generate required files and ensure dependencies.
```
The `enyo init` command is designed to aid in managing the dependencies and initialization of new or current projects. For new projects it will generate a configuration file `.enyoconfig` based on your current user-defaults, a generic `package.json` file (if one does not exist) and a `.gitignore` (if it doesn't exist) or will update an existing one to ignore the most common files and directories that should be ignored in Enyo projects.

You can disable the generation or modification of the named files by setting the appropriate flags:

```bash
# no .enyoconfig file
--no-config

# no package.json file
--no-package

# no .gitignore
--no-git-ignore
```

Here are some other examples of using the command:

```bash
# begin a new project
enyo init my-new-project

# initialize an existing project in the current working directory
enyo init

# even if your project defaults have lots of libraries, you can
# override the defaults from the command line
enyo init --libraries=enyo,moonstone,spotlight,enyo-ilib

# and even save the changes in the project configuration
enyo init --libraries=enyo,moonstone,spotlight,enyo-ilib --save

# or have it install/clone some libraries while linking others that you
# are debugging
enyo init --libraries=enyo,moonstone --links=enyo

# to initialize a project as a library as opposed to an application
# use the --library flag
enyo init --library

# to set the title (literally the &#lt;title/&#gt;) of your project
# use the --title, or --name for the project used in other capacities
# these flags are automatically saved
enyo init --title 'My Project\'s Grand Title' --name my-project
```


#### <a name="commands-link"></a>link - `enyo link`

```bash
Usage: enyo link [target] [options]

target     The name of the target, linkable library to link into the current project. If omitted the current library will be made linkable by-name from other projects. This can also be a comma-separated list of linkable libraries to link into the current project. The name value is taken from the .enyoconfig (project-level configuration) if it exists otherwise it will fail.

Options:
   -c, --config-file     Set this to a custom configuration file, otherwise defaults to .enyoconfig in the target working directory.
   -i, --interactive     Various commands may need user input. To avoid interactive sessions and always use the built-in resolution options set this to false.
   --script-safe         When executing commands within an automated script or without an active terminal set this flag to true.
   -f, --force           In cases where a symbolic link, file or directory already exists in the target location by the same name, remove it and continue anyway. NOTE: only use this option if you know what you are doing!
   --save                If set and in a project, will add the library or libraries to the existing project-level configuration "links" property.
   -l, --list            Print a list of linked libraries in the current project or, if not in a project, will list all linkable (known) libraries.
   -L, --list-linkable   Regardless of the current working directory, list the known, linkable libraries.

Make the current library linkable from other projects or link a linkable library into the current project.
```

The `enyo link` command can be used to link an existing, linkable library into your current project or to make your current project linkable to other projects. This is very useful when you are modifying a library you already have locally and you do not want multiple copies.

Make sure you checkout [enyo unlink](#commands-unlink) and [enyo find-links](#commands-find-links) for additional resources related to linking libraries on your system.

```bash
# we want to link the enyo framework/library into a new project
# so we ensure it is linkable on our system
cd enyo
enyo link
cd ../
enyo init my-new-project --links=enyo
cd my-new-project

# to get a list of the linked libraries in the current project simply
# use the --list flag
enyo link --list

# to see all of the linkable libraries on your system use --list-linkable
# from anywhere
enyo link --list-linkable

# from an existing project you can add linkable libraries
# this would take your linkable enyo repository and link it into your
# existing project
enyo link enyo

# if you had a cloned copy you can force it to create the link anyway
enyo link --force enyo

# you can also link multiple libraries at the same time
enyo link enyo,moonstone,enyo-webos

# you can even use the enyo link command to save changes directly to your
# project configuration file
enyo link enyo,moonstone --save
```

#### <a name="commands-unlink"></a>unlink `enyo unlink`

```bash
Usage: enyo unlink [target] [options]

target     The name of the target library to unlink from the given project. If using --unlink-all this can be set to a relative path to the target project. Target can be a comma-separated list of libraries to unlink.

Options:
   -c, --config-file   Set this to a custom configuration file, otherwise defaults to .enyoconfig in the target working directory.
   -i, --interactive   Various commands may need user input. To avoid interactive sessions and always use the built-in resolution options set this to false.
   --script-safe       When executing commands within an automated script or without an active terminal set this flag to true.
   -U, --unlink-all    Set this to unlink all linked libraries in the current project. Use the --save flag to indicate you wish to also remove all entries in the "links" property array. If --unlink-all is used with --global it will unlink all linkable projects in the user's environment (essentially a reset for linkable projects).
   -g, --global        If set, the target library will be unlinked from the user's environment or, if set with the --unlink-all flag will unlink all linkable projects from the users's environment as if they were outside of a project directory.
   --save              Set this to save changes made to a project, ignored if the --global flag is set.

Unlink the target library from the current project or, if linkable, remove the current library from linkable libraries by other projects.
```

The `enyo unlink` command is designed to work in-tandem with the [enyo link](#commands-link) command to make managing linkable libraries easier. With `enyo unlink` you can unlink one or more linked libraries from your current project or remove libraries from your linkable libraries stash.

```bash
# to unlink one or more libraries from your current project
enyo unlink enyo
enyo unlink enyo,moonstone

# or to also remove the libraries from your "links" property in the project
# configuration file
enyo unlink --save enyo,moonstone

# to remove a linkable library from your environment
enyo unlink -g enyo,layout

# to unlink all linked libraries in your current project
enyo unlink --unlink-all
enyo unlink -U

# or to remove all linkable libraries in your environment
enyo unlink -g --unlink-all
enyo unlink -g -U
```

#### <a name="commands-find-links"></a>find-links `enyo find-links`

```bash
Usage: enyo find-links [target] [options]

target     The target directory to begin searching for linkable libraries. Defaults to the current working directory.

Options:
   -c, --config-file   Set this to a custom configuration file, otherwise defaults to .enyoconfig in the target working directory.
   -i, --interactive   Various commands may need user input. To avoid interactive sessions and always use the built-in resolution options set this to false.
   --script-safe       When executing commands within an automated script or without an active terminal set this flag to true.
   --force             Set this to ensure that even if a link already exists it will be re-linked.

Quickly find libraries and make them linkable by other projects. It executes a recursive search but igores symbolic links. This will only find libraries that have been properly initialized as a library and uses the "name" value of their configuration. If a duplicate library is encountered  and interactive mode is disabled the duplicates will be reported but ignored. If interactive mode is on, it will ask you which path to use for a given duplicate library.
```

The `enyo find-links` command is a convenience method used to quickly find all linkable local project repositories you may have. Usually there is no harm in having them all linked as you control which libraries are linked into your current project. It is possible to have multiple copies of the same library (same name, different location on the filesystem). In these cases the interactive mode will allow you to choose which version of the library you should have linkend. Note that this method is recursive from the directory you set (default is current working directory). It will only find and make linkable libraries that have been initiated as a library by [enyo init](#commands-init) with the `--library` flag (`"library": true` in the .enyoconfig and a valid `"name"` property).

```bash
# if you have lots of local repositories below a particular directory on your system
# you can just point this command to the root
enyo find-links ../repos

# if you already have some links that may be pointing at bad or incorrect filesystem
# locations use the --force flag to ensure it will properly update them
enyo find-links --force ~/Devel/repos

# you can then check to see what libraries it linked by using
enyo link --list-linkable

# or by using
enyo link --list from a non-project directory
```

### <a name="commands-pack"></a> pack `enyo pack` (also `epack`)

```bash
Usage: enyo pack [package] [options]

package     The relative path to the application directory to package. Defaults to the current working directory. Cannot be defined in configuration.

Options:
   -c, --config-file                          Set this to a custom configuration file, otherwise defaults to .enyoconfig in the target working directory.
   -i, --interactive                          Various commands may need user input. To avoid interactive sessions and always use the built-in resolution options set this to false.
   --script-safe                              When executing commands within an automated script or without an active terminal set this flag to true.
   -l, --log-level                            Typically only used for debugging purposes. The process pipes a JSON stream of output that can be piped through the bunyan utility to be human-readable. Available options [fatal, error, warn, info, debug, trace]. Defaults to "warn".
   -P, --production                           Build in production mode; supersedes the --dev-mode and --no-dev-mode flags. Defaults to false.
   -D, --dev-mode                             Whether or not this build is a development build; negated if --production set. Defaults to true.
   --cache                                    Enables the use of a cache-file, if it exists and also the ability to write to the cache-file. This cache-file can significantly improve build times in some cases. To force a clean build but cache the results simply remove the cache-file. To disable use --no-cache. Defaults to true.
   -r, --reset-cache                          Allows you to ignore an existing cache-file but still write the cached output for subsequent runs. Defaults to false. The same as removing the current cache-file.
   --trust-cache                              Convenience flag only used during watch-mode, when set, will default to using the cached data without re-building the output. This should only be used when you are certain nothing has changed and it has no need to re-evaluate the input source or re-produce any of the output files. Can be used with enyo serve. Defaults to false.
   --cache-file                               Set this to a specific filename for the cache file. If it is not the default, then this will need to be set to the correct file name in subsequent runs to be found and used. Defaults to ".enyocache".
   --clean                                    This will empty the outdir before writing any new files to it. Helpful when switching build modes or when assets/styles have changed and old files may be lingering. Defaults to false.
   --source-maps                              Whether or not to build source-maps when in --dev-mode; disable with --no-source-maps. Defaults to true (only applies to --dev-mode).
   --paths                                    A comma-separated list of paths relative to the current working directory to search for libraries and their modules. Specifying these from the command-line will override any found in the configuration or defaults. Note that if specified in the configuration file they are relative to the package, not the current working directory. Also note that the tools will still search the defined libDir when any provided paths have been exhausted.
   --externals                                To build without bundled external libraries, use --no-externals; always false when in --library mode. NOTE that the library is still required to compile even if the output will not include it. Defaults to true.
   --list-only                                Set this flag to have it output the dependency tree to stdout. Defaults to false. Cannot be defined in configuration.
   --strict                                   By default, if a style-file or asset file is missing, or if an asset path cannot be properly translated, only a warning will be issued. If this is true then it will halt the compilation. Defaults to false.
   --skip                                     A comma-separated list of external libraries that should not be included in the output when not in --library mode.

		Example: --skip=enyo,moonstone

   --library                                  Produce a library build instead of a packaged application build from the designated package and entry file; will ignore the --template-index flag. Defaults to false.
   --include-wip                              By default when building a library it will ignore modules with the string "wip" in the filename (for single-file modules) or if the "wip" property in the package.json is true. If you would like to include WIP modules set this to true or remove those properties. Defaults to false.
   --title                                    To set the <title/> of the output project index if not in --library mode. Usually set in the configuration so it will consistently build with the same title. If not specified here or in the configuration will default to the name of the project.
   -d, --outdir                               Where to place the output files, this value is relative to the current working directory. If the value is provided by the configuration file it will be relative to the package location. Defaults to "./dist"
   -o, --outfile                              The output filename for the compiled application HTML when not in --library mode. Defaults to "index.html".
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
   --watch-paths PATHS                        By default, using --watch will only target the local application (or library) source. To have it also watch additional paths use this comma-separated list to name the paths. Note that, this should be used sparingly as it can have a negative impact on performance and in some cases crash the process if there are too many files. Can be configured in the configuration file but has no defined default.
   --polling                                  When using the --watch command, this will force the watcher to use filesystem polling instead of native (and more efficient) FSEvents. Only use this is you are having an issue with the number of files being watched or are using a network filesystem mount -- WARNING -- it will SIGNIFICANTLY reduce performance. Defaults to false.
   -I INTERVAL, --polling-interval INTERVAL   When using the --polling flag, set this to the time in milliseconds to poll the filesystem for changes. Has no effect if --polling is not set. Defaults to "100".
   -a, --analytics                            Whether or not to produce the self-contained analytics.html file with information and visualizations about the current build.  [false]
   --head-scripts                             A comma-separated list of paths relative to the current working directory of ordered JavaScript files to arbitrarily add at the beginning of all JavaScript source. In development mode these files will be loaded separately while in production they will be inlined unless the --no-inline-js flag is used. Without strict mode enabled, warnings will be issued when named files cannot be resolved. This option has no meaning in library mode [.enyoconfig option "headScripts" - ARRAY - relative paths to project].
   --tail-scripts                             A comma-separated list of paths relative to the current working directory of ordered JavaScript files to arbitrarily add at the end of all JavaScript source. In development mode these files will be loaded separately while in production they will be inlined unless the --no-inline-js flag is used. Without strict mode enabled, warnings will be issued when named files cannot be resolved. This option has no meaning in library mode [.enyoconfig option "tailScripts" - ARRAY - relative paths to project].
   --promise-polyfill                         When using the request feature for asynchronous loading the platform needs to have support for Promises. If the target platform does not support Promises or to ensure that the application can support platforms that do not have Promise support set this flag to true [.enyoconfig option "promisePolyfill" - BOOLEAN - false].
   --style-only                               Set this flag to only output final style files. All other settings apply normally [.enyoconfig option "styleOnly" - BOOLEAN - false].

Build an Enyo 2.6 application and optionally watch for changes and automatically rebuild.
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

##### <a name="commands-pack-errors"></a>Error handling/debugging

Error reporting by the `enyo pack` command are handled via a dependency called [bunyan](https://github.com/trentm/node-bunyan). By default, it reports errors in a JSON format that isn't particularly human-friendly but is _very useful and convenient for filtering and passing around log-files for assistance when debugging_. If you see errors, rather than deciphering the JSON manually, install the `bunyan` command globally (e.g. `npm install bunyan -g`) which will then allow you to make the output more readable in real-time or after-the-fact when you pipe it to e a file.

Examples:

```bash
# to see human readable output when running the command
enyo pack -l info | bunyan -o short

# or to narrow down output for a particular part of the process that
# you have identified might be the problem area
enyo pack -l info | bunyan -o short -c 'this.component == "process-source-stream"'

# or for even more output use debug
enyo pack -l debug | bunyan -o short

# you can even track the progress of a particular module or bundle by name
enyo pack -l info | bunyan -o short -c 'this.module == "enyo/kind"'
# if your project's name was my-project
enyo pack -l debug | bunyan -o short -c 'this.bundle == "my-project"'

# to make it easier to filter/trace problems in a build you should
# output to a file that can be scanned as many times as necessary
enyo pack -l debug > build.log

# then you can read the file many different ways or post/email it
# for a second set of eyes for debugging further
bunyan -o short build.log -c 'this.level == ERROR'
```


### <a name="commands-serve"></a> serve `enyo serve` (also `eserve`)

```bash
Usage: enyo serve [package] [options]

package     The relative path to the application directory to package. Defaults to the current working directory. Cannot be defined in configuration.

Options:
   -c, --config-file                          Set this to a custom configuration file, otherwise defaults to .enyoconfig in the target working directory.
   -i, --interactive                          Various commands may need user input. To avoid interactive sessions and always use the built-in resolution options set this to false.
   --script-safe                              When executing commands within an automated script or without an active terminal set this flag to true.
   -l, --log-level                            Typically only used for debugging purposes. The process pipes a JSON stream of output that can be piped through the bunyan utility to be human-readable. Available options [fatal, error, warn, info, debug, trace]. Defaults to "warn".
   -P, --production                           Build in production mode; supersedes the --dev-mode and --no-dev-mode flags. Defaults to false.
   -D, --dev-mode                             Whether or not this build is a development build; negated if --production set. Defaults to true.
   --cache                                    Enables the use of a cache-file, if it exists and also the ability to write to the cache-file. This cache-file can significantly improve build times in some cases. To force a clean build but cache the results simply remove the cache-file. To disable use --no-cache. Defaults to true.
   -r, --reset-cache                          Allows you to ignore an existing cache-file but still write the cached output for subsequent runs. Defaults to false. The same as removing the current cache-file.
   --trust-cache                              Convenience flag only used during watch-mode, when set, will default to using the cached data without re-building the output. This should only be used when you are certain nothing has changed and it has no need to re-evaluate the input source or re-produce any of the output files. Can be used with enyo serve. Defaults to false.
   --cache-file                               Set this to a specific filename for the cache file. If it is not the default, then this will need to be set to the correct file name in subsequent runs to be found and used. Defaults to ".enyocache".
   --clean                                    This will empty the outdir before writing any new files to it. Helpful when switching build modes or when assets/styles have changed and old files may be lingering. Defaults to false.
   --source-maps                              Whether or not to build source-maps when in --dev-mode; disable with --no-source-maps. Defaults to true (only applies to --dev-mode).
   --paths                                    A comma-separated list of paths relative to the current working directory to search for libraries and their modules. Specifying these from the command-line will override any found in the configuration or defaults. Note that if specified in the configuration file they are relative to the package, not the current working directory. Also note that the tools will still search the defined libDir when any provided paths have been exhausted.
   --externals                                To build without bundled external libraries, use --no-externals; always false when in --library mode. NOTE that the library is still required to compile even if the output will not include it. Defaults to true.
   --list-only                                Set this flag to have it output the dependency tree to stdout. Defaults to false. Cannot be defined in configuration.
   --strict                                   By default, if a style-file or asset file is missing, or if an asset path cannot be properly translated, only a warning will be issued. If this is true then it will halt the compilation. Defaults to false.
   --skip                                     A comma-separated list of external libraries that should not be included in the output when not in --library mode.

		Example: --skip=enyo,moonstone

   --library                                  Produce a library build instead of a packaged application build from the designated package and entry file; will ignore the --template-index flag. Defaults to false.
   --include-wip                              By default when building a library it will ignore modules with the string "wip" in the filename (for single-file modules) or if the "wip" property in the package.json is true. If you would like to include WIP modules set this to true or remove those properties. Defaults to false.
   --title                                    To set the <title/> of the output project index if not in --library mode. Usually set in the configuration so it will consistently build with the same title. If not specified here or in the configuration will default to the name of the project.
   -d, --outdir                               Where to place the output files, this value is relative to the current working directory. If the value is provided by the configuration file it will be relative to the package location. Defaults to "./dist"
   -o, --outfile                              The output filename for the compiled application HTML when not in --library mode. Defaults to "index.html".
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
   -W, --watch                                Will build the output and continue to monitor the filesystem for changes to the source files and automatically update the build. Defaults to false. If set to false, the server becomes a standard web-server.  [true]
   --watch-paths PATHS                        By default, using --watch will only target the local application (or library) source. To have it also watch additional paths use this comma-separated list to name the paths. Note that, this should be used sparingly as it can have a negative impact on performance and in some cases crash the process if there are too many files. Can be configured in the configuration file but has no defined default.
   --polling                                  When using the --watch command, this will force the watcher to use filesystem polling instead of native (and more efficient) FSEvents. Only use this is you are having an issue with the number of files being watched or are using a network filesystem mount -- WARNING -- it will SIGNIFICANTLY reduce performance. Defaults to false.
   -I INTERVAL, --polling-interval INTERVAL   When using the --polling flag, set this to the time in milliseconds to poll the filesystem for changes. Has no effect if --polling is not set. Defaults to "100".
   -a, --analytics                            Whether or not to produce the self-contained analytics.html file with information and visualizations about the current build.  [false]
   --head-scripts                             A comma-separated list of paths relative to the current working directory of ordered JavaScript files to arbitrarily add at the beginning of all JavaScript source. In development mode these files will be loaded separately while in production they will be inlined unless the --no-inline-js flag is used. Without strict mode enabled, warnings will be issued when named files cannot be resolved. This option has no meaning in library mode [.enyoconfig option "headScripts" - ARRAY - relative paths to project].
   --tail-scripts                             A comma-separated list of paths relative to the current working directory of ordered JavaScript files to arbitrarily add at the end of all JavaScript source. In development mode these files will be loaded separately while in production they will be inlined unless the --no-inline-js flag is used. Without strict mode enabled, warnings will be issued when named files cannot be resolved. This option has no meaning in library mode [.enyoconfig option "tailScripts" - ARRAY - relative paths to project].
   --promise-polyfill                         When using the request feature for asynchronous loading the platform needs to have support for Promises. If the target platform does not support Promises or to ensure that the application can support platforms that do not have Promise support set this flag to true [.enyoconfig option "promisePolyfill" - BOOLEAN - false].
   --style-only                               Set this flag to only output final style files. All other settings apply normally [.enyoconfig option "styleOnly" - BOOLEAN - false].
   -p, --port                                 The port to bind to for incoming requests.  [8000]
   --localOnly                                Whether or not to only accept connections from localhost. Supersedes the bind-address value if set.  [false]
   -R, --web-root                             The relative path from the current working directory to host files from. The default is the outdir value or if watch is false and this is unspecified it will use the current working directory.
   -B, --bindAddress                          If you need the server to bind to a specific address set this value. This is ignored if local-only is true.

Executes an HTTP server capabale of automatically rebuilding a project's source when changes occur. With watch set to false, is a simple web-server.
```

The `enyo serve` command has the same options as [enyo pack](#commands-pack) with a few additional configurations related to the server it starts. This is a convenience command designed to let you quickly and easily test your projects in your browser and automatically rebuild when you make changes. You can also use it just to host a particular project quickly without rebuild or watching the source.

Note that you cannot use `--watch` in `--production` mode. 

```bash
# to build and serve, watching for changes in a valid project
enyo serve

# to quickly serve an existing build from within a project that is in the
# default output director "dist"
enyo serve --no-watch -R dist
enyo serve --no-W -R dist

# if using a network filesystem mounted directory you cannot use the built-in
# events system and will need to use polling (MUCH SLOWER)
enyo serve --polling

# to use a custom port
enyo serve -p 8867

# to watch a library source as well as app source set it in the --watch-paths list
# but use this sparingly as it degrades performance with massive changes and when
# watching lots of files on some systems
enyo serve --watch-paths=lib/enyo,lib/moonstone

# if you have already built the application but do want to watch for changes without
# rebuilding use the --trust-cache option to make it startup faster
enyo serve --trust-cache
```



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
