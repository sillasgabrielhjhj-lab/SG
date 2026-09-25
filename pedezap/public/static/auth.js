'use strict';

(function () {
  const mode = document.body.dataset.mode;
  document.querySelectorAll('[data-show]').forEach((el) => {
    el.hidden = el.dataset.show !== mode;
  });

  const form = document.getElementById('authForm');
  const error = document.getElementById('authError');
  const submit = document.getElementById('authSubmit');
  const password = document.getElementById('password');
  if (mode === 'cadastro') password.autocomplete = 'new-password';

  // Máscara simples de telefone: (81) 99999-9999
  const whatsapp = document.getElementById('whatsapp');
  whatsapp.addEventListener('input', () => {
    const d = whatsapp.value.replace(/\D/g, '').slice(0, 11);
    let out = d;
    if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    whatsapp.value = out;
  });

  (mode === 'cadastro' ? document.getElementById('store_name') : document.getElementById('email')).focus();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    const data = Object.fromEntries(new FormData(form));
    const problem =
      mode === 'cadastro' && !data.store_name.trim()
        ? 'Informe o nome da loja.'
        : mode === 'cadastro' && whatsapp.value.replace(/\D/g, '').length < 10
          ? 'Informe o WhatsApp com DDD.'
          : mode === 'cadastro' && !data.name.trim()
            ? 'Informe seu nome.'
            : !data.email.includes('@')
              ? 'Informe um e-mail válido.'
              : mode === 'cadastro' && data.password.length < 8
                ? 'A senha precisa ter pelo menos 8 caracteres.'
                : null;
    if (problem) {
      error.textContent = problem;
      error.hidden = false;
      return;
    }

    busy(submit, true);
    try {
      const body =
        mode === 'cadastro' ? data : { email: data.email, password: data.password };
      await api('POST', mode === 'cadastro' ? '/api/cadastro' : '/api/entrar', body);
      window.location.href = '/painel';
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      busy(submit, false);
    }
  });
})();
