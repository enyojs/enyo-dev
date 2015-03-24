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

#### enyo-pack

The `enyo-pack` command packages the source for an Enyo application. It may also be executed using the `epack` alias.

By default, `enyo-pack` will create a __dist__ directory with an automatically generated __index.html__ including both
the source and CSS for the application (a single file containing the output). Sources are specified in __package.json__ file
in the [package] directory (by default, the current directory). The output can be customized using the options below.

To see a list of available options use `enyo-pack --help`

```
Usage: enyo-pack | epack [package] [options]

package     The relative path to the application directory to package

Options:
   -l, --log-level        What level of output to use [error, log, debug, info, verbose]  [info]
   -D, --dev-mode         Whether or not this build is a development build  [true]
   -L, --lib-path         The relative path from the package root to where the libraries can be found  [lib]
   --title                To set the <title> of the output project index
   --include-libs         This is a comma-separated, ordered list of libraries that have library-level options (package.json) that need to be included in the final build. If the library is explicitly required in the source it does not need to be in this list.
   -d, --outdir           Where to place the output files  [./dist]
   -o, --outfile          The output filename for the compiled application HTML  [index.html]
   -a, --asset-outdir     The directory for all assets in the package output, relative to outdir  [.]
   -c, --css-outfile      If the compiled CSS should not be inserted into the packaged HTML file
   -j, --js-outfile       If the compiled JS should not be inserted into the packaged HTML file
   -t, --template-index   Instead of using the auto-generated HTML index, start from this file
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
