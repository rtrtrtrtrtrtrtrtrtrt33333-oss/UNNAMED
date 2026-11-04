(() => {
    const sections = [...document.querySelectorAll('[data-section]')];
    const names = new Set(sections.map(section => section.dataset.section));
    const content = document.getElementById('site-content');
    const sectionContent = document.getElementById('section-content');
    const baseTitle = document.title;

    let requestedName;
    let revision = 0;
    let animation;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    async function fade(from, to) {
        animation?.cancel();
        animation = sectionContent.animate([{ opacity: from }, { opacity: to }], {
            duration: 180,
            easing: 'ease-in-out',
            fill: 'forwards'
        });
        await animation.finished.catch(() => {});
    }

    async function render(focus = false) {
        const name = names.has(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
        if (name === requestedName) return;
        const firstRender = requestedName === undefined;
        requestedName = name;
        const currentRevision = ++revision;
        const currentOpacity = Number(getComputedStyle(sectionContent).opacity);
        animation?.cancel();
        const animate = !firstRender && !reducedMotion.matches;
        if (animate) {
            await fade(currentOpacity, 0);
            if (currentRevision !== revision) return;
        }
        sections.forEach(section => {
            section.hidden = section.dataset.section !== name;
        });
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            if (link.hash === `#${name}`) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        document.title = name === 'home' ? baseTitle : `${name[0].toUpperCase() + name.slice(1)} | ${baseTitle}`;
        document.getElementById('lightbox')?.classList.remove('active');
        document.body.style.overflow = '';
        if (focus) {
            const active = sections.find(section => !section.hidden);
            active.tabIndex = -1;
            active.focus({ preventScroll: true });
            // Keep the hero visible when switching near the top of the page.
            if (window.scrollY > content.offsetTop) content.scrollIntoView({ block: 'start' });
        }
        if (animate) {
            await fade(0, 1);
            if (currentRevision !== revision) return;
        }
        sectionContent.getAnimations().forEach(effect => effect.cancel());
    }

    document.addEventListener('click', event => {
        const link = event.target.closest('a[href^="#"]');
        if (!link || !names.has(link.hash.slice(1)) || event.button !== 0 ||
            event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (location.hash !== link.hash) history.pushState(null, '', link.hash);
        render(true);
    });
    window.addEventListener('popstate', () => render());
    window.addEventListener('hashchange', () => render());
    render();
})();
