'use strict';

const combineDuplicates = require('../combine-duplicates.js');

module.exports = class CssAnalyzer {
    static analyze(node, isFirstNode = true) {
        const errors = {
            prefix: [],
            knownBugs: [],
        };

        errors.prefix.push(...CssAnalyzer._prefixErrors(node));
        errors.knownBugs.push(...CssAnalyzer._knownBugs(node));

        for (const childNode of node.children || []) {
            const childErrors = CssAnalyzer.analyze(childNode, false);
            for (const resultType of Object.keys(childErrors)) {
                errors[resultType].push(...childErrors[resultType]);
            }
        }

        if (isFirstNode) {
            return combineDuplicates(errors);
        }

        return errors;
    }

    static _prefixErrors(node) {
        const errors = [];

        if (node.styles != node.prefixedStyles) {
            // Find missing prefixes
            for (const property in node.prefixedStyles) {
                const prefix = CssAnalyzer._getPrefixFromProperty(property);
                if (typeof node.styles[property] != 'undefined' && prefix) {
                    const baseProperty = CssAnalyzer._getUnprefixedProperty(property);
                    errors.push({
                        type: 'error',
                        message: 'The CSS property "%base" should also be included with the %prefix prefix.'.replace('%base', property).replace('%prefix', prefix),
                        preview: node.preview,
                    });
                }
            }

            // @TODO: Add handling of values with prefixes (ex.: -webkit-linear-gradient)
        }

        return errors;
    }

    static _knownBugs(node) {
        const errors = [];

        if (typeof node.styles == 'undefined') {
            node.styles = {};
        }

        // Fieldset with display flex/grid
        if (node.tag == 'fieldset' && ['flex', 'grid', 'inline-flex', 'inline-grid'].indexOf(node.styles.display || null) != -1) {
            errors.push({
                type: 'error',
                message: 'The fieldset element does not support flex or grid styling.',
                preview: node.preview,
            });
        }


		// Fixed elements with or inside transform
        if ((node.styles.transform || 'none') != 'none') {
            let childrenNodes = node.children || [];

            while (childrenNodes.length) {
                let nextChildrenNodes = [];

    			for (const childNode of childrenNodes) {
                    if ((childNode.styles.position || null) == 'fixed') {
    					errors.push({
                            type: 'error',
                            message: 'Fixed elements should not use the transform property, or be nested inside an transformed element.',
                            preview: node.preview,
                            reference: 'https://stackoverflow.com/questions/15194313/transform3d-not-working-with-position-fixed-children/15256339#15256339'
                        });
    				} else {
                        nextChildrenNodes = nextChildrenNodes.concat(childNode.children);
                    }
    			}

                childrenNodes = nextChildrenNodes;
            }
		}

        return errors;
    }



	static _getUnprefixedProperty(property) {
        return property.replace(/-(webkit|moz|ms|o|khtml)-/, '');
	}

	static _getPrefixFromProperty(property) {
		const prefixes = ['-webkit-', '-moz-', '-ms-', '-o-', '-khtml-'];

		for (const prefix of prefixes) {
			if (property.indexOf(prefix) === 0) {
				return prefix;
			}
		}

		return null;
	}
}
