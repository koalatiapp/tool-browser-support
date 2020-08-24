'use strict';

const puppeteer = require('puppeteer');
let autoprefixer = require('autoprefixer');
const postcss = require('postcss');
const CSSParser = require('jscssp');
const path = require('path');
const caniuseEquivalences = require('../config/caniuse-equivalences.json');

module.exports = class DomStandardizer {
    static async standardize(page, browserlistQuery) {
        const specificityPath = path.dirname(require.resolve("specificity/package.json"));
        await page.addScriptTag({ path: specificityPath + '/dist/specificity.js' });

        const styles = await DomStandardizer._getStyleObjectsFromPage(page);
        const nodesData = await DomStandardizer._getNodesDataWithStyles(page, styles);

        autoprefixer = autoprefixer({ overrideBrowserslist: browserlistQuery });
        await DomStandardizer._addPrefixDataToNodes(nodesData);

        return nodesData;
    }

    static async _getStyleObjectsFromPage(page) {
        let rawStylesheets = await DomStandardizer._getRawStylesheetsFromPage(page);
        let parsedStylesheets = DomStandardizer._parseRawStylesheets(rawStylesheets);
        return parsedStylesheets;
    }

    // Gets the content of every <style> and <link rel='stylesheet'> nodes
    static async _getRawStylesheetsFromPage(page) {
        return await page.evaluate(async () => {
            const rawStylesheets = [];
            const nodes = document.querySelectorAll('style, link[rel="stylesheet"]');

            for (let node of nodes) {
                if (node.tagName == 'STYLE') {
                    rawStylesheets.push(node.innerHTML);
                } else {
                    if (node.href) {
                        const content = await (fetch(node.href).then((response) => {
                        	return response.text();
                        }).then((data) => {
                        	return data;
                        }).catch(() => {
                            // Simply ignore stylesheets that cannot be fetched this way.
                            return null;
                        }));

                        if (content) {
                            rawStylesheets.push(content);
                        }
                    }
                }
            }

            return rawStylesheets;
        });
    }

    // Parses raw stylesheets and returns them as an array of jscsspStylesheet
    static _parseRawStylesheets(rawStylesheets) {
        let rules = [];
        let parser = new CSSParser.CSSParser();

        for (let rawStylesheet of rawStylesheets) {
            let sheet = parser.parse(rawStylesheet, false, true);
            let sheetRules = DomStandardizer._getRuleObjectsFromParsedStylesheet(sheet);

            for (let rule of sheetRules) {
                rules.push(rule);
            }
        }

        return rules;
    }

    // Shapes the parsed rules into a simpler object structure and returns those in an array
    static _getRuleObjectsFromParsedStylesheet(sheet) {
        let rules = [];

        // jscsspStylesheet can be annoying to work with: store the rules in an array.
        if (sheet) {
            for (let rule of sheet.cssRules) {
                if ('mSelectorText' in rule) {
                    let ruleObject = { selector: rule.mSelectorText, properties: [] };

                    for (let i = 0; i < rule.declarations.length; i++) {
                        if (typeof rule.declarations[i].valueText != 'undefined') {
                            ruleObject.properties.push({ property: rule.declarations[i].property, value: rule.declarations[i].valueText.trim(), important: rule.declarations[i].priority });
                        } else {
                            // This declaration is most likely a comment, so we skip it.
                        }
                    }

                    rules.push(ruleObject);
                } else if ('cssRules' in rule) {
                    let subRules = DomStandardizer._getRuleObjectsFromParsedStylesheet(rule);

                    for (let subRule of subRules) {
                        rules.push(subRule);
                    }
                }
            }
        }

        return rules;
    }


    /********************************************************************/
    /********************************************************************/
    /****************************  STEP 2  ******************************/
    /********************************************************************/
    /********************************************************************/

    static async _getNodesDataWithStyles(page, styles) {
        return await page.evaluate((styles, caniuseEquivalences) => {
            function getNodeData(node) {
                const data = {};

                // @TODO: analyze pseudo elements as well

                data.tag = node.tagName.toLowerCase();
                data.attributes = getNodeAttributes(node);
                data.selector = buildSelectorForNode(node);
                data.preview = node.outerHTML.length > 300 ? node.outerHTML.substr(0, 300) : node.outerHTML;
                data.applicableCssRules = getApplicableStylesForNode(node);
                data.styles = buildComputedStyleFromRules(data.applicableCssRules);
                data.caniuseEntries = getMatchingCaniuseEntries(node);
                data.children = [];

                // The function is called recursively on every child node
                // This is what generates data for the entire DOM
                for (let childNode of node.children) {
                    data.children.push(getNodeData(childNode));
                }

                return data;
            }

            function getNodeAttributes(node) {
                let attributesObject = {};

                for (let i = 0; i < node.attributes.length; i++) {
                    const attr = node.attributes[i];
                	attributesObject[attr.name] = attr.value;
                }

                return attributesObject;
            }

            function getMatchingCaniuseEntries(node) {
                let entries = [];

                // HTML entries are simply matched by selector
                for (let entry in caniuseEquivalences.html) {
                    let selector = caniuseEquivalences.html[entry];

                    if (selector == 'NA' || selector == 'TODO') {
                        continue;
                    }

                    if (node.matches(selector)) {
                        entries.push(entry);
                    }
                }

                return entries;
            }

            function buildSelectorForNode(node) {
                let path;

                while (node) {
                    let name = node.localName;

                    if (!name || name == 'html') {
                        break;
                    }

                    idSelector = node.id && name != 'body' ? '#' + node.id : '';
                    classSelector = (node.className && name != 'body' && typeof node.className.replace == 'function') ? '.' + node.className.replace(' ', '.') : '';
                    name = name.toLowerCase() + (idSelector ? idSelector : classSelector);

                    let parent = node.parentElement;
                    path = name + (path ? ' > ' + path : '');
                    node = parent;
                }

                return path;
            }

            function getApplicableStylesForNode(node) {
                let applicableRules = [];

                for (let rule of styles) {
                    try {
                        if (node.matches(rule.selector)) {
                            applicableRules.push(rule);
                        }
                    } catch (e) {
                        // The selector is most likely invalid or non-applicable
                    }
                }

                // Sort rules by the specifity of their selector
                applicableRules.sort((a, b) => {
                    try {
                        return SPECIFICITY.compare(a.selector, b.selector);
                    } catch (e) {
                        // Invalid selector error
                        return 0;
                    }
                });

                return applicableRules;
            }

            function buildComputedStyleFromRules(applicableCssRules) {
                const styles = {};
                const importantProperties = [];

                for (let rule of applicableCssRules) {
                    for (let declaration of rule.properties) {
                        let alreadyImportant = importantProperties.indexOf(declaration.property) != -1;

                        if (typeof styles[declaration.property] == 'undefined') {
                            styles[declaration.property] = declaration.value;

                            if (declaration.important) {
                                importantProperties.push(declaration.property);
                            }
                        } else if (!alreadyImportant || (alreadyImportant && declaration.important)) {
                            styles[declaration.property] = declaration.value;

                            if (!alreadyImportant && declaration.important) {
                                importantProperties.push(declaration.property);
                            }
                        }
                    }
                }

                return styles;
            }

            // Execution happens here - the rest of the flow for step 2 is defined in the functions above.
            return [getNodeData(document.documentElement)];
        }, styles, caniuseEquivalences);
    }


    /********************************************************************/
    /********************************************************************/
    /****************************  STEP 3  ******************************/
    /********************************************************************/
    /********************************************************************/

    static async _addPrefixDataToNodes(nodesData) {
        const postcssInstance = postcss([autoprefixer]);

        for (let i = 0; i < nodesData.length; i++) {
            let styles = JSON.parse(JSON.stringify(nodesData[i].styles));

            for (const property in styles) {
                for (const prefix of ['-webkit-', '-moz-', '-ms-', '-o-', '-khtml-']) {
                    if (property.indexOf(prefix) === 0 && property.substr(prefix.length) in styles) {
                        delete styles[property];
                    }
                }
            }

            const unprefixedCSS = DomStandardizer._stylesObjectToString(styles);
            let autoprefixerResult = await postcssInstance.process(unprefixedCSS, { from: undefined });

            nodesData[i].prefixedStyles = DomStandardizer._stylesStringToObject(autoprefixerResult.css);

            if (nodesData[i].children) {
                await DomStandardizer._addPrefixDataToNodes(nodesData[i].children);
            }
        }
    }







    /********************************************************************/
    /********************************************************************/
    /***********************  HELPER FUNCTIONS  *************************/
    /********************************************************************/
    /********************************************************************/

    static _stylesObjectToString(styles) {
        let string = '';

        for (let property in styles) {
            string += property + ': ' + styles[property] + '; ';
        }

        return string.trim();
    }

    static _stylesStringToObject(stylesString) {
        let parser = new CSSParser.CSSParser();
        let sheet = parser.parse('span { ' + stylesString + ' }', false, true);
        let rule = sheet.cssRules[0];
        let styleObject = {};

        for (let i = 0; i < rule.declarations.length; i++) {
            styleObject[rule.declarations[i].property] = rule.declarations[i].valueText;
        }

        return styleObject;
    }
}
