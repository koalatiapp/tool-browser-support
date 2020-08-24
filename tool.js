'use strict';

const DomStandardizer = require('./lib/dom-standardizer.js');
const caniuseEquivalences = require('./config/caniuse-equivalences.json');

class Tool {
    constructor({ page, payload }) {
        this.page = page;
        this.payload = payload;
    }

    async run() {
        const browserlistQuery = this.payload && this.payload.browserlistQuery ? this.payload.browserlistQuery : 'defaults';
        const standardizedElements = await DomStandardizer.standardize(this.page, browserlistQuery);
    }

    get results() {

    }

    async cleanup() {

    }
}

module.exports = Tool;
