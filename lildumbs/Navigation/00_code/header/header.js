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
        ["Main site", "--nav-main-site-link"],
        ["Gallery", "--nav-main-gallery-link"],
        ["Devlog", "--nav-main-devlog-link"],
        ["Unnamed Project", "--nav-unnamed-project-link"],
    ].map(([label, varName]) => {
        const link = document.createElement("a");
        link.href = resolveProjectLink(getCssText(varName));
        link.textContent = label;
        link.dataset.externalSiteLink = "true";
        return link;
    });
}

function addExternalNavigation() {
    const url = getCssText("--nav-main-site-link");
    if (!url) return;

    if (!document.querySelector(".external-site-nav")) {
        const externalNav = document.createElement("nav");
        externalNav.className = "external-site-nav";
        externalNav.setAttribute("aria-label", "Main website navigation");
        externalNav.append(...createExternalLinks());
        document.body.prepend(externalNav);
    }

    document.querySelectorAll(".sidebar").forEach((sidebar) => {
        if (sidebar.querySelector(".sidebar-external")) return;

        const group = document.createElement("div");
        const groupLabel = document.createElement("span");

        group.className = "sidebar-external";
        groupLabel.className = "sidebar-external-label";
        groupLabel.textContent = "Projects";
        group.appendChild(groupLabel);

        createExternalLinks().forEach((externalLink) => {
            const icon = document.createElement("span");
            const label = document.createElement("span");

            icon.className = "sidebar-icon";
            icon.innerHTML = "&#10022;";
            label.className = "sidebar-label";
            label.textContent = externalLink.textContent;

            externalLink.textContent = "";
            externalLink.append(icon, label);
            group.appendChild(externalLink);
        });

        sidebar.prepend(group);
    });

    document.querySelectorAll(".footer-links").forEach((footerLinks) => {
        if (footerLinks.parentElement?.querySelector(".footer-external-links")) return;

        const externalLinks = document.createElement("div");
        externalLinks.className = "footer-links footer-external-links";
        externalLinks.append(...createExternalLinks());
        footerLinks.insertAdjacentElement("afterend", externalLinks);
    });
}

window.addEventListener("scroll", () => {

    const progress =
        Math.min(window.scrollY / 250, 1);

    document.documentElement
        .style
        .setProperty(
            "--scroll",
            progress
        );

});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addExternalNavigation);
} else {
    addExternalNavigation();
}
