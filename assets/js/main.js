document.documentElement.classList.add('js');

(function () {
    'use strict';

    const toggle = document.getElementById('mobile-menu-toggle');
    const nav = document.getElementById('main-nav');

    function setMenu(open) {
        if (!toggle || !nav) return;
        nav.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
    }

    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            setMenu(!nav.classList.contains('is-open'));
        });
        nav.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => setMenu(false));
        });
        document.addEventListener('click', (e) => {
            if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) {
                setMenu(false);
            }
        });
    }

    const reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && reveals.length) {
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        io.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
        );
        reveals.forEach((el) => io.observe(el));
    } else {
        reveals.forEach((el) => el.classList.add('is-visible'));
    }
})();
