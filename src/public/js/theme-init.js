(() => {
    try {
        const stored = localStorage.getItem('worldnet_theme');
        const dark = stored === 'dark' || ((!stored || stored === 'auto') && matchMedia('(prefers-color-scheme: dark)').matches);
        if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    } catch (e) {
        /* theme is a progressive enhancement */
    }
})();