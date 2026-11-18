(() => {
    const main = document.querySelector('main');
    if (!main) return;

    const sectionOrder = ['empires', 'characters', 'regions', 'timelines', 'aspects'];
    for (const name of sectionOrder) {
        const html = window.navigationSections?.[name];
        if (!html) continue;
        const panel = document.createElement('section');
        panel.id = name;
        panel.dataset.navigationSection = name;
        panel.innerHTML = html;
        main.append(panel);
    }

    // Header and sidebar links retain their #section destinations.
    // Wait until injected sections exist before following an incoming hash.
    if (location.hash) {
        requestAnimationFrame(() => {
            document.getElementById(location.hash.slice(1))?.scrollIntoView();
        });
    }
})();
