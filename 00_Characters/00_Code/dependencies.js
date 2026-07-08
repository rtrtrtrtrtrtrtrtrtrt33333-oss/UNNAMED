const styles = [
    "../00_Code/css/aspect.css",
    "../00_Code/css/layout.css",
    "../00_Code/css/header.css",

];

const scripts = [
    "../00_code/js/header.js",
    "../00_code/js/playlist.js"
];

styles.forEach(href => {
    document.head.insertAdjacentHTML(
        "beforeend",
        `<link rel="stylesheet" href="${href}">`
    );
});

(async () => {
    for (const src of scripts) {
        await new Promise(resolve => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
})();