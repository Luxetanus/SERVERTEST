(() => {
  const ready = () => {
    document.body.classList.remove('page-loading');
    document.body.classList.add('page-ready');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }

  window.teurgiaFadeTo = function(url) {
    document.body.classList.add('page-leaving');
    setTimeout(() => { window.location.href = url; }, 220);
  };

  window.teurgiaShowView = function(show, hide) {
    if (!show || !hide || show === hide) return;
    hide.classList.add('fade-out');
    setTimeout(() => {
      hide.classList.add('hidden');
      hide.classList.remove('fade-out');
      show.classList.remove('hidden');
      show.classList.add('fade-in');
      setTimeout(() => show.classList.remove('fade-in'), 360);
    }, 170);
  };

  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-fade-link]');
    if (!link || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    window.teurgiaFadeTo(link.href);
  });
})();
