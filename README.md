# Browser support tool for Koalati

This is the repository for Koalati's built-in Browser support tool. This tool analyzes webpages to find elements, CSS properties and scripts that might not work as expected on certain browsers.

## DOM parser: collecting and standardizing data for analysis

The DomParser class included with this tool is used to prepare a standardized array of objects that can then easily be looped over to check for issues.

Here are the steps used to standardize the data:

1.  Parse every `<style>` and `<link rel='stylesheet'>` into CSS rule objects, and store them by selector
2.  Go over the page's nodes and loop over the CSS objects to build each node's real CSS, using node.matches(selector) to determine if a rule applies to a node or not. Once every rule has been fetched following the CSS selector priority, without forgetting to take `!important` into account. Also add every matching `caniuse` entries to each nodes, for HTML and CSS.
3.  Loop over each node's computed styles, remove vendor prefixes that are present in addition to the regular tag, and build the prefixed styles using `postcss` and `autoprefixer`.
4.  Return results, with one result per `caniuse` test/entry.


## Contributing

If you would like to add features, fix bugs or optimize this tool, feel free to fork this repository and submit a pull request.

You can find more information on how to build and test Koalati tools in the [Tool Template's Documentation](https://github.com/koalatiapp/tool-template).
