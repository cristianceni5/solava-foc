// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: animare con discrezione l'ingresso delle sezioni e dei link della home.

(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !window.gsap || !window.ScrollTrigger) return;

    gsap.registerPlugin(ScrollTrigger);

    gsap.fromTo('.home-intro-copy > *',
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: .65, stagger: .09, ease: 'power2.out', clearProps: 'all' }
    );

    document.querySelectorAll('.home-section').forEach(sezione => {
        gsap.fromTo(sezione.querySelectorAll('.home-section-heading, .home-section-content'),
            { autoAlpha: 0, y: 16 },
            {
                autoAlpha: 1,
                y: 0,
                duration: .55,
                stagger: .08,
                ease: 'power2.out',
                clearProps: 'all',
                scrollTrigger: { trigger: sezione, start: 'top 90%', once: true }
            }
        );
    });

    const listaReparti = document.getElementById('lista-reparti');
    new MutationObserver(mutations => {
        const nuoviLink = mutations.flatMap(mutation =>
            [...mutation.addedNodes].filter(nodo => nodo.nodeType === 1 && nodo.matches('a'))
        );
        if (!nuoviLink.length || !ScrollTrigger.isInViewport(listaReparti, .1)) return;
        gsap.fromTo(nuoviLink,
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: .35, stagger: .035, ease: 'power2.out', clearProps: 'all' }
        );
    }).observe(listaReparti, { childList: true });

    document.getElementById('apri-impostazioni').addEventListener('click', () => {
        gsap.fromTo('#dialog-impostazioni',
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: .22, ease: 'power2.out', clearProps: 'all' }
        );
    });
})();
