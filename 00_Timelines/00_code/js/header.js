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