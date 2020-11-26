'use strict';

module.exports = (errorsByType) => {
    const occurences = {};
    const mergedErrors = [];

    for (const errorType in errorsByType) {
        const errors = errorsByType[errorType];

        for (const index in errors) {
            const error = errors[index];

            if (!(error.message in occurences)) {
                error.previews = [error.preview];
                delete error.preview;
                delete error.node;

                if ('browser' in error) {
                    error.browsers = [error.browser];
                    error.browsersByNote = [];

                    for (const note of error.notes) {
                        error.browsersByNote[note] = [error.browser];
                    }
                }

                occurences[error.message] = error;
            } else {
                occurences[error.message].previews.push(error.preview);

                if ('browser' in error) {
                    occurences[error.message].browsers.push(error.browser);

                    for (const note of error.notes) {
                        const existingNotes = occurences[error.message].browsersByNote[$note] || [];
                        const newNotes = [error.browser];
                        const mergedNotes = existingNotes.concat(newNotes.filter((item) => existingNotes.indexOf(item) < 0));
                        occurences[error.message].browsersByNote[$note] = mergedNotes;
                    }
                }

                delete errors[index];
            }
        }

        mergedErrors.concat(errors);
    }

    return mergedErrors;
};
