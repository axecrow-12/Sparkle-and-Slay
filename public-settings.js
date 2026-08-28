const publicSettingsFallback = {
  store_name: 'Sparkle & Slay',
  email: 'sales@sparkleandslay.com',
  phone: '+263 77 659 3476',
  whatsapp: '+263776593476',
  ecocash_merchant_number: '0783 123 456',
  address: 'Corner Robert and Angwa, NiceWear Mall Shop 2, Harare, Zimbabwe',
  facebook: 'https://facebook.com/sparkleandslay',
  instagram: 'https://instagram.com/sparkleandslay',
  tiktok: 'https://tiktok.com/@sparkleandslay',
};

function applyPublicSettings(settings) {
  document.querySelectorAll('[data-setting]').forEach((element) => {
    const value = settings[element.dataset.setting];
    if (value === undefined) return;
    if (element.dataset.setting === 'address') {
      element.textContent = value;
      return;
    }
    if (element.tagName === 'A') {
      if (element.dataset.setting === 'email') element.href = `mailto:${value}`;
      else if (element.dataset.setting === 'phone') element.href = `tel:${value.replace(/\s+/g, '')}`;
      else if (element.dataset.setting === 'whatsapp') element.href = `https://wa.me/${value.replace(/\D/g, '')}`;
      else element.href = value;
    }
    if (element.dataset.setting === 'email' || element.dataset.setting === 'phone') element.textContent = value;
  });
  document.querySelectorAll('[data-setting-text]').forEach((element) => {
    const value = settings[element.dataset.settingText];
    if (value !== undefined) element.textContent = value;
  });

  document.querySelectorAll('a[href^="mailto:"]').forEach((element) => {
    element.href = `mailto:${settings.email}`;
    if (element.textContent.trim()) element.textContent = settings.email;
  });
  document.querySelectorAll('a[href^="tel:"]').forEach((element) => {
    element.href = `tel:${settings.phone.replace(/\s+/g, '')}`;
    if (element.textContent.trim()) element.textContent = settings.phone;
  });
  document.querySelectorAll('a[href*="wa.me"]').forEach((element) => {
    element.href = `https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`;
  });
  ['facebook', 'instagram', 'tiktok'].forEach((network) => {
    document.querySelectorAll(`a[href*="${network}.com"]`).forEach((element) => {
      element.href = settings[network];
    });
  });
  document.querySelectorAll('p').forEach((element) => {
    if (element.textContent.includes('Corner Robert and Angwa')) element.textContent = settings.address;
  });
}

function loadPublicSettings() {
  applyPublicSettings(publicSettingsFallback);
  if (typeof USE_BACKEND !== 'undefined' && USE_BACKEND) {
    fetch(`${API_BASE}/settings/public`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Settings unavailable')))
      .then(applyPublicSettings)
      .catch(() => {});
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadPublicSettings);
else loadPublicSettings();