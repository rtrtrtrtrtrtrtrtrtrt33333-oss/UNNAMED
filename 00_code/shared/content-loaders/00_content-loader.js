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
        return cleanLink(getVar(varName));
    }

    function cleanLink(value) {
        return value
            .replace(/^url\(['"]?/, '')
            .replace(/['"]?\)$/, '')
            .replace(/^['"]|['"]$/g, '');
    }

    function getProjectRootUrl() {
        const currentUrl = new URL(window.location.href);
        const path = currentUrl.pathname;
        const folders = [
            '/Navigation/',
            '/Characters/',
            '/Regions/',
            '/Empires/',
            '/Timelines/',
            '/Aspects/',
            '/00_code/',
        ];

        for (const folder of folders) {
            const index = path.indexOf(folder);
            if (index !== -1) {
                return new URL(path.slice(0, index + 1), currentUrl);
            }
        }

        return new URL('./', currentUrl);
    }

    function resolveProjectLink(url) {
        if (/^(https?:|mailto:|data:|#)/.test(url) || url.startsWith('./') || url.startsWith('../') || url.startsWith('/')) {
            return url;
        }

        return new URL(url, getProjectRootUrl()).href;
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

            if (el.tagName === 'A') {
                el.href = resolveProjectLink(url);
                return;
            }

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
