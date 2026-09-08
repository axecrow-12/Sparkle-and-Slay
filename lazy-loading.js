document.addEventListener("DOMContentLoaded", () => {

  /*
   * Scroll reveal
   */

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-visible");

        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -50px 0px"
    }
  );

  const observeRevealElements = () => {
    document
      .querySelectorAll(
        ".reveal, .reveal-fade, .reveal-scale, .reveal-left, .reveal-right, .reveal-stagger"
      )
      .forEach((element) => {

        if (
          !element.classList.contains("is-visible") &&
          !element.hasAttribute("data-reveal-observed")
        ) {
          element.setAttribute("data-reveal-observed", "true");
          revealObserver.observe(element);
        }

      });
  };

  observeRevealElements();


  /*
   * Lazy-load images
   */

  const imageObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {

        if (!entry.isIntersecting) return;

        const image = entry.target;

        if (image.dataset.src) {
          image.src = image.dataset.src;
        }

        if (image.dataset.srcset) {
          image.srcset = image.dataset.srcset;
        }

        image.addEventListener(
          "load",
          () => {
            image.classList.add("loaded");
          },
          { once: true }
        );

        observer.unobserve(image);
      });
    },
    {
      rootMargin: "200px 0px"
    }
  );


  const observeImages = () => {
    document
      .querySelectorAll("img[data-src], img.lazy-image")
      .forEach((image) => {

        if (!image.hasAttribute("data-lazy-observed")) {
          image.setAttribute("data-lazy-observed", "true");
          imageObserver.observe(image);
        }

      });
  };

  observeImages();


  /*
   * Watch for products/cards added dynamically
   * by your existing JavaScript.
   */

  const mutationObserver = new MutationObserver(() => {
    observeRevealElements();
    observeImages();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });


  /*
   * Automatically add reveal animations to
   * common Sparkle & Slay sections.
   */

  const automaticRevealSelectors = [
    ".home-benefit",
    ".section-header",
    ".arrivals-header",
    ".home-collection-copy",
    ".home-collection-image",
    ".about-media",
    ".about-text",
    ".contact-section",
    ".site-footer .footer-section",
    ".admin-intro",
    ".metric-card",
    ".workspace-panel"
  ];

  automaticRevealSelectors.forEach((selector) => {

    document.querySelectorAll(selector).forEach((element) => {

      if (
        !element.classList.contains("reveal") &&
        !element.classList.contains("reveal-fade") &&
        !element.classList.contains("reveal-scale") &&
        !element.classList.contains("reveal-left") &&
        !element.classList.contains("reveal-right")
      ) {
        element.classList.add("reveal");
      }

    });

  });

  observeRevealElements();

});