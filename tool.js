'use strict';

const DomStandardizer = require('./lib/dom-standardizer.js');
const CssAnalyzer = require('./lib/analyzer/css.js');

class Tool {
    constructor({ page, payload }) {
        this.page = page;
        this.payload = payload;
    }

    async run() {
        const browserlistQuery = this.payload && this.payload.browserlistQuery ? this.payload.browserlistQuery : 'defaults';
        const standardizedDomTree = await DomStandardizer.standardize(this.page, browserlistQuery);
        const cssErrors = CssAnalyzer.analyze(standardizedDomTree[0]);

        console.log(cssErrors);
    }

    get results() {

    }

    async cleanup() {

    }
}

module.exports = Tool;
