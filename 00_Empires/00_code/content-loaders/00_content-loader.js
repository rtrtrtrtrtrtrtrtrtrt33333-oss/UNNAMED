(function () {
    function getVar(varName) {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
            .trim();
    }

    function getText(varName) {
        return getVar(varName)
            .replace(/^['"]|['"]$/g, '')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"');
    }

    function getUrl(varName) {
        return getVar(varName)
            .replace(/^url\(['"]?/, '')
            .replace(/['"]?\)$/, '');
    }

    function applyTexts() {
        document.querySelectorAll('[data-text]').forEach((el) => {
            const text = getText(el.getAttribute('data-text'));
            if (text) el.textContent = text;
        });
    }

    function applyLinks() {
        document.querySelectorAll('[data-link]').forEach((el) => {
            const url = getUrl(el.getAttribute('data-link'));
            if (!url) return;
            el.src = url;
        });

        document.querySelectorAll('source[data-link]').forEach((source) => {
            const url = getUrl(source.getAttribute('data-link'));
            if (!url) return;

            source.src = url;

            const media = source.parentElement;
            if (media?.tagName === 'AUDIO' || media?.tagName === 'VIDEO') {
                media.load();
            }
        });
    }

    function applyAll() {
        applyTexts();
        applyLinks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyAll);
    } else {
        applyAll();
    }
})();