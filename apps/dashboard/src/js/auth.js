// Sign-in, registration, TOTP enrollment and step-up.
//
// Financial actions call requireStrong() first. The Compliance Kernel
// requires a STRONG session (password + TOTP step-up) for them; this only
// gets the user there honestly. It never asserts anything to the server that
// the user did not just prove.

import { api, clearSession, friendlyMessage, getSession, setTokens, ApiError } from './api.js';
import { CONFIG } from './config.js';
import { act, dialog, field, h, note, toast } from './ui.js';

const TERMS_VERSION = 'sunrey-sandbox-terms-2026-11';

export function isStrong(session = getSession()) {
  return Boolean(session && (session.strength === 'STRONG' || session.strength === 'HIGH_ASSURANCE'));
}

// ---- screens ---------------------------------------------------------------

export function authScreen(onAuthenticated) {
  let mode = 'login';
  const host = h('div', { class: 'auth-card' });

  function render() {
    const login = mode === 'login';
    host.replaceChildren(
      h('h1', { class: 'auth-title' }, login ? 'Welcome' : 'Open your', h('span', { class: 'accent' }, login ? 'back.' : 'SunRey account.')),
      h('p', { class: 'muted' }, login ? 'Sign in to your SunRey dashboard.' : 'One account for banking, Grow, the Exchange and your Vault.'),
      login ? loginForm() : registerForm(),
    );
  }

  function loginForm() {
    const email = h('input', { type: 'email', autocomplete: 'username', required: true });
    const password = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const error = h('p', { class: 'form-error', role: 'alert' });
    const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Sign in');
    const form = h(
      'form',
      {
        class: 'stack',
        onsubmit: (e) => {
          e.preventDefault();
          error.textContent = '';
          act(submit, async () => {
            try {
              const { data } = await api.post('/auth/login', { email: email.value, password: password.value }, { auth: false });
              if (data.kind === 'MFA_REQUIRED') {
                const bundle = await totpPrompt({ title: 'Two-step verification', mfaToken: data.mfaToken });
                if (!bundle) return;
                setTokens(bundle, { email: email.value });
              } else {
                setTokens(data, { email: email.value });
              }
              onAuthenticated();
            } catch (err) {
              error.textContent = friendlyMessage(err);
            }
          });
        },
      },
      field('Email', email),
      field('Password', password),
      error,
      submit,
      h('p', { class: 'muted small center' }, 'New to SunRey? ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); mode = 'register'; render(); } }, 'Create an account')),
    );
    return form;
  }

  function registerForm() {
    const email = h('input', { type: 'email', autocomplete: 'username', required: true });
    const password = h('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: '12' });
    const terms = h('input', { type: 'checkbox', required: true });
    const error = h('p', { class: 'form-error', role: 'alert' });
    const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Create account');
    return h(
      'form',
      {
        class: 'stack',
        onsubmit: (e) => {
          e.preventDefault();
          error.textContent = '';
          if (!terms.checked) {
            error.textContent = 'Please accept the sandbox terms.';
            return;
          }
          act(submit, async () => {
            try {
              await api.post('/auth/register', { email: email.value, password: password.value, termsVersion: TERMS_VERSION }, { auth: false });
              const { data } = await api.post('/auth/login', { email: email.value, password: password.value }, { auth: false });
              setTokens(data, { email: email.value });
              toast('Account created. Set up two-step verification to unlock financial actions.', 'positive');
              onAuthenticated();
            } catch (err) {
              error.textContent = friendlyMessage(err);
            }
          });
        },
      },
      field('Email', email),
      field('Password', password, 'At least 12 characters.'),
      h(
        'label',
        { class: 'check' },
        terms,
        h('span', null, 'I understand this is a sandbox: identity verification is simulated, no real money moves, and nothing here is investment advice.'),
      ),
      error,
      submit,
      h('p', { class: 'muted small center' }, 'Already have an account? ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); mode = 'login'; render(); } }, 'Sign in')),
    );
  }

  render();
  return h(
    'div',
    { class: 'auth-screen' },
    h('header', { class: 'auth-top' }, h('img', { src: '/assets/wordmark.svg', alt: 'SunRey', width: '120', height: '18' }), h('span', { class: 'badge badge-env' }, CONFIG.environmentLabel)),
    h('div', { class: 'auth-center' }, host),
    h('p', { class: 'auth-foot' }, `${CONFIG.environmentLabel} environment. Balances, trades and tokens here are simulated and are not real money.`),
  );
}

// ---- TOTP -----------------------------------------------------------------

function codeInput() {
  return h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]{6}', maxlength: '6', required: true, class: 'code-input' });
}

/** Ask for a 6-digit code and complete an MFA challenge. Resolves to a token bundle or null. */
export function totpPrompt({ title, mfaToken, intro }) {
  return new Promise((resolve) => {
    let settled = false;
    const code = codeInput();
    const error = h('p', { class: 'form-error', role: 'alert' });
    const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Verify');
    const form = h(
      'form',
      {
        class: 'stack',
        onsubmit: (e) => {
          e.preventDefault();
          act(submit, async () => {
            try {
              const { data } = await api.post('/auth/mfa/verify', { mfaToken, code: code.value.trim() }, { auth: false });
              settled = true;
              d.close();
              resolve(data);
            } catch (err) {
              error.textContent = err instanceof ApiError && err.code === 'AUTH_REQUIRED' ? 'That code was not accepted. Codes change every 30 seconds.' : friendlyMessage(err);
            }
          });
        },
      },
      h('p', null, intro || 'Enter the 6-digit code from your authenticator app.'),
      field('Code', code),
      error,
      submit,
    );
    const d = dialog({ title, content: form, onClose: () => !settled && resolve(null) });
  });
}

/** Enroll TOTP for the signed-in customer. Resolves true when confirmed. */
export async function enrollTotp() {
  const { data } = await api.post('/auth/mfa/enroll', {});
  return new Promise((resolve) => {
    let done = false;
    const code = codeInput();
    const error = h('p', { class: 'form-error', role: 'alert' });
    const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Confirm');
    const secret = h('code', { class: 'secret' }, data.secretBase32.replace(/(.{4})/g, '$1 ').trim());
    const form = h(
      'form',
      {
        class: 'stack',
        onsubmit: (e) => {
          e.preventDefault();
          act(submit, async () => {
            try {
              await api.post('/auth/mfa/enroll/confirm', { enrollToken: data.enrollToken, code: code.value.trim() });
              done = true;
              d.close();
              toast('Two-step verification is on.', 'positive');
              resolve(true);
            } catch (err) {
              error.textContent = friendlyMessage(err);
            }
          });
        },
      },
      h('p', null, 'Add SunRey to an authenticator app (1Password, Google Authenticator, Authy). Enter this setup key manually, choosing a time-based code:'),
      secret,
      h('p', { class: 'muted small' }, h('a', { href: data.otpauth }, 'Open in authenticator app'), ' (on a device that has one installed).'),
      note('Keep this key private. Anyone with it can generate your codes.', 'warning'),
      field('First code from the app', code),
      error,
      submit,
    );
    const d = dialog({ title: 'Set up two-step verification', content: form, onClose: () => !done && resolve(false) });
  });
}

/**
 * Ensure the current session is STRONG before a financial action.
 * Returns true if the session is (now) strong enough.
 */
export async function requireStrong(reason) {
  if (isStrong()) return true;
  const session = getSession();
  if (!session) return false;
  let status;
  try {
    status = await api.get('/auth/mfa/status');
  } catch (err) {
    toast(friendlyMessage(err), 'negative');
    return false;
  }
  if (status.authenticationStrength === 'STRONG' || status.authenticationStrength === 'HIGH_ASSURANCE') {
    setTokens({ ...session, authenticationStrength: status.authenticationStrength }, { email: session.email });
    return true;
  }
  if (!status.totpEnrolled) {
    const enrolled = await enrollTotp();
    if (!enrolled) return false;
  }
  try {
    const { data } = await api.post('/auth/mfa/step-up', {});
    const bundle = await totpPrompt({
      title: 'Confirm it’s you',
      mfaToken: data.mfaToken,
      intro: `${reason || 'This action'} needs a fresh confirmation. Enter the code from your authenticator app.`,
    });
    if (!bundle) return false;
    setTokens(bundle, { email: session.email });
    return isStrong();
  } catch (err) {
    toast(friendlyMessage(err), 'negative');
    return false;
  }
}

export async function signOut() {
  try {
    await api.post('/auth/logout', {});
  } catch {
    /* the session may already be gone */
  }
  clearSession();
}
