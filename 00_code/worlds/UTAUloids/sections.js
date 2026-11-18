(() => {
    const main = document.querySelector('main');
    const panels = new Map([['home', main.querySelector('[data-navigation-section="home"]')]]);
    for (const [name, html] of Object.entries(window.navigationSections || {})) {
        const panel = document.createElement('section');
        panel.dataset.navigationSection = name;
        panel.hidden = true;
        panel.innerHTML = html;
        main.append(panel);
        panels.set(name, panel);
    }
    const title = document.title;
    let current;
    function show() {
        const name = panels.has(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
        if (name === current) return;
        for (const [key, panel] of panels) panel.hidden = key !== name;
        document.querySelectorAll('a').forEach(link => {
            const url = new URL(link.href, location.href);
            if (url.pathname !== location.pathname) return;
            if (url.hash === '#' + name) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        if (current !== undefined && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            panels.get(name).animate([{opacity: 0}, {opacity: 1}], {duration: 180});
        }
        document.title = name === 'home' ? title : `${name[0].toUpperCase() + name.slice(1)} | ${title}`;
        current = name;
    }
    document.addEventListener('click', event => {
        const link = event.target.closest('a');
        if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin || url.pathname !== location.pathname || !panels.has(url.hash.slice(1))) return;
        event.preventDefault();
        if (url.hash !== location.hash) history.pushState(null, '', url.hash);
        show();
        const panel = panels.get(current);
        panel.tabIndex = -1;
        panel.focus({preventScroll: true});
    });
    window.addEventListener('hashchange', show);
    window.addEventListener('popstate', show);
    // Existing content loaders finish resolving menu links before initial highlighting.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
    else show();
})();
