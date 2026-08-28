(function () {
  const splashScreen = document.getElementById('splashScreen');
  if (!splashScreen) {
    return;
  }

  const SEEN_KEY = 'sparkleSplashSeen';

  if (sessionStorage.getItem(SEEN_KEY)) {
    // Already seen this session, skip the wait and hide immediately.
    splashScreen.classList.add('hide-instant');
    return;
  }

  sessionStorage.setItem(SEEN_KEY, 'true');
  setTimeout(() => {
    splashScreen.classList.add('hide');
  }, 3000);
})();
