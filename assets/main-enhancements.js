(() => {
  const qs = id => document.getElementById(id);

  function loadCssOnce(id, href) {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  loadCssOnce('teurgia-palatino-font-css', 'assets/palatino-font.css?v=20260625p');

  const ready = () => {
    document.body.classList.remove('page-loading');
    document.body.classList.add('page-ready');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();

  window.teurgiaFadeTo = function(url) {
    document.body.classList.add('page-leaving');
    setTimeout(() => { window.location.href = url; }, 220);
  };

  window.teurgiaShowView = function(show, hide) {
    if (!show || !hide || show === hide) return;
    if (show.classList.contains('hidden')) {
      hide.classList.add('fade-out');
      setTimeout(() => {
        hide.classList.add('hidden');
        hide.classList.remove('fade-out');
        show.classList.remove('hidden');
        show.classList.add('fade-in');
        setTimeout(() => show.classList.remove('fade-in'), 360);
      }, 170);
    }
  };

  function enhanceExistingFunctions() {
    const modal = qs('loginModal');
    const landing = qs('landingView');
    const dashboard = qs('dashboardView');

    if (modal && typeof window.abrirLogin === 'function' && !window.abrirLogin.__teurgiaEnhanced) {
      const originalOpen = window.abrirLogin;
      window.abrirLogin = function(area) {
        originalOpen(area);
        modal.classList.remove('hidden');
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
      };
      window.abrirLogin.__teurgiaEnhanced = true;
    }

    if (modal && typeof window.cerrarLogin === 'function' && !window.cerrarLogin.__teurgiaEnhanced) {
      window.cerrarLogin = function() {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(() => modal.classList.add('hidden'), 220);
      };
      window.cerrarLogin.__teurgiaEnhanced = true;
    }

    if (typeof window.mostrarInicio === 'function' && !window.mostrarInicio.__teurgiaEnhanced) {
      window.mostrarInicio = function() {
        if (landing && dashboard && !dashboard.classList.contains('hidden')) window.teurgiaShowView(landing, dashboard);
        else if (landing) landing.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      window.mostrarInicio.__teurgiaEnhanced = true;
    }

    if (typeof window.actualizarEstadoAuth === 'function' && !window.actualizarEstadoAuth.__teurgiaEnhanced) {
      const originalAuth = window.actualizarEstadoAuth;
      window.actualizarEstadoAuth = function() {
        const wasLanding = landing && !landing.classList.contains('hidden');
        const wasDashboard = dashboard && !dashboard.classList.contains('hidden');
        originalAuth();
        if (landing && dashboard) {
          if (wasLanding && !dashboard.classList.contains('hidden')) window.teurgiaShowView(dashboard, landing);
          if (wasDashboard && !landing.classList.contains('hidden')) window.teurgiaShowView(landing, dashboard);
        }
      };
      window.actualizarEstadoAuth.__teurgiaEnhanced = true;
    }

    const loginButtons = document.querySelectorAll('button[onclick*="abrirLogin"]');
    loginButtons.forEach(btn => btn.classList.add('smooth-action'));
  }

  document.addEventListener('DOMContentLoaded', enhanceExistingFunctions);
  window.addEventListener('load', enhanceExistingFunctions);

  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-fade-link]');
    if (!link || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    window.teurgiaFadeTo(link.href);
  });
})();