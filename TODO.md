

# Packager Requirements

### Overarching

- Use provided HTML index or TEMPLATE index for final output
- Produce inline or external JS file
- Produce inline or external CSS file
- Development mode differences
	- JS source-maps included
	- un-minified code
	- human-readable HTML output (beautified)
- Handle package-level style declarations
- Handle package-level asset declarations
	


### Style Specific Requirements

- Concatenate stylesheets in the order in which they are encountered
- Compile LESS once all stylesheets have been collected
	- (*May need to be able to exclude additional library inclusion*)
- Ensure that all @import statements are properly re-mapped relative to their final locations
- Ensure that all url() statements are properly re-mapped relative to their final locations
- Be able to produce asset dependency list from concatenated source




### JS Specific Requirements

- Project output should only include the minimum required modules from all sources
- Should be able to include non-commonjs libraries as well
- Relatively map require statements from app source-code to a relative path of the matching library source

