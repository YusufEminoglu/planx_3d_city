// Status toasts: short messages at the bottom of the viewer.

// Status messages (progress, results, errors) as a small toast at the
// bottom left; it fades after a few seconds. (They used to go to a
// #dem-status element the page no longer has.)
let _statusTimer = null;
export function setStatus(text, isError = false) {
  let el = document.getElementById('dem-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dem-status';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.innerText = text || '';
  el.classList.toggle('is-error', !!isError);
  el.classList.toggle('is-visible', !!text);
  clearTimeout(_statusTimer);
  if (text) _statusTimer = setTimeout(() => el.classList.remove('is-visible'), isError ? 9000 : 5000);
}
