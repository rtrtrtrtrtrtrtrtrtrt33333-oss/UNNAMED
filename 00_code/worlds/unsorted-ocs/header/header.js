function getProjectRootUrl() {
    const currentUrl = new URL(window.location.href);
    const path = currentUrl.pathname;
    const folders = [
        "/Navigation/",
        "/Characters/",
        "/Regions/",
        "/Empires/",
        "/Timelines/",
        "/Aspects/",
        "/00_code/",
    ];

    for (const folder of folders) {
        const index = path.indexOf(folder);
        if (index !== -1) {
            return new URL(path.slice(0, index + 1), currentUrl);
        }
    }

    return new URL("./", currentUrl);
}

function getCssText(varName) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim()
        .replace(/^['"]|['"]$/g, "");
}

function resolveProjectLink(url) {
    if (/^(https?:|mailto:|data:|#|\/)/.test(url)) {
        return url;
    }

    return new URL(url, getProjectRootUrl()).href;
}

function createExternalLinks() {
    return [
        ["Main", "--nav-main-site-link"],
        ["Gallery", "--nav-main-gallery-link"],
        ["Devlog", "--nav-main-devlog-link"],
        ["Worlds", "--nav-main-worlds-link"],
    ].map(([label, varName]) => {
        const link = document.createElement("a");
        link.href = resolveProjectLink(getCssText(varName));
        link.textContent = label;
        link.dataset.externalSiteLink = "true";
        return link;
    });
}

const EXTERNAL_NAV_ICONS = {
    main: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path></svg>',
    gallery: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>',
    devlog: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M8 13h8M8 17h6"></path></svg>',
    worlds: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"></path></svg>',
};

function createExternalSidebarLinks() {
    return [
        ["home", "Home", "--nav-main-site-link"],
        ["gallery", "Gallery", "--nav-main-gallery-link"],
        ["devlog", "Devlog", "--nav-main-devlog-link"],
        ["worlds", "Worlds", "--nav-main-worlds-link"],
    ].map(([iconName, label, varName]) => {
        const link = document.createElement("a");
        const icon = document.createElement("span");
        const text = document.createElement("span");

        link.href = resolveProjectLink(getCssText(varName));
        link.title = label;
        icon.className = `sidebar-icon sidebar-icon-${iconName}`;

        text.className = "sidebar-label";
        text.textContent = label;
        link.append(icon, text);
        return link;
    });
}

function addExternalNavigation() {
    const internalNav = document.querySelector(".header-nav");
    if (internalNav && !internalNav.querySelector(".header-universe-name")) {
        const name = document.createElement("span");
        name.className = "header-universe-name";
        name.textContent = getCssText("--nav-universe-name");
        internalNav.prepend(name);
    }

    const url = getCssText("--nav-main-site-link");
    if (!url) return;

    if (!document.querySelector(".external-site-nav")) {
        const externalNav = document.createElement("nav");
        externalNav.className = "external-site-nav";
        externalNav.setAttribute("aria-label", "Main website navigation");
        externalNav.append(...createExternalLinks());
        document.body.prepend(externalNav);
    }

    if (!document.querySelector(".external-site-sidebar")) {
        const externalSidebar = document.createElement("aside");
        externalSidebar.className = "external-site-sidebar site-main-sidebar";
        externalSidebar.setAttribute("aria-label", "Main website sidebar navigation");
        const heading = document.createElement("h3");
        heading.textContent = "Navigation";
        const aboutHeading = document.createElement("h3");
        aboutHeading.textContent = "About";
        const aboutText = document.createElement("p");
        aboutText.textContent = "Personal website. Idk why it just looks sick";
        externalSidebar.append(heading, ...createExternalSidebarLinks());
        externalSidebar.append(document.createElement("hr"), aboutHeading, aboutText);
        document.body.prepend(externalSidebar);
    }

    document.querySelectorAll(".footer-links").forEach((footerLinks) => {
        if (footerLinks.parentElement?.querySelector(".footer-external-links")) return;

        const externalLinks = document.createElement("div");
        externalLinks.className = "footer-links footer-external-links";
        externalLinks.append(...createExternalLinks());
        footerLinks.insertAdjacentElement("afterend", externalLinks);
    });
}

function updateHeaderScroll() {
    const progress = Math.max(0, Math.min(window.scrollY / 250, 1));
    document.documentElement.style.setProperty("--scroll", progress);
}
window.addEventListener("scroll", updateHeaderScroll, { passive: true });
window.addEventListener("pageshow", updateHeaderScroll);
updateHeaderScroll();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addExternalNavigation);
} else {
    addExternalNavigation();
}
