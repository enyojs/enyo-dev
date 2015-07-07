

## <a name="assets"></a>Asset Handling

Assets come in many forms and are included by applications in many different ways. In an attempt to support the necessary possibilities while also maintaining simplicity several techniques have been provided.

* [How to include Assets](#assets-how-to-include-assets)
* [Referencing from style](#assets-referencing-from-style)
	* [warning](#assets-referencing-from-style-warning)
* [Referencing from JavaScript](#assets-referencing-from-javascript)
* [How it works](#assets-how-it-works)
	* [conventions](#assets-conventions)

#### <a name="assets-how-to-include-assets"></a>How to include assets

Assets can be included from any module's _package.json_ file. There are 2 properties associated with assets: `assets` and `devAssets`. Both are _ordered arrays of relative paths or relative [globs](https://github.com/isaacs/node-glob#glob)_. The `assets` property, if present, will be used _in every build_ of the project whereas the `devAssets` property, if present, will only be used in [dev-mode](#options-dev-mode). The ability to _sometimes_ include assets during development is handy for using mock-data or providing some files for development that would, in production, be provided by some other means.

For example,

```json
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

#### <a name="assets-reference-from-style"></a>Referencing from style

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

### <a name="assets-referencing-from-style-warning"></a>Warning

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

#### <a name="assets-referencing-from-javascript"></a>Referencing from JavaScript

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

#### <a name="assets-how-it-works"></a>How it works

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


