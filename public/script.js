const form = document.querySelector('#entry-form');
const fileInput = document.querySelector('#file');
const fileMessage = document.querySelector('#file-message');
const counter = document.querySelector('#count');
const idea = document.querySelector('#description');
if (idea && counter) {
  const update = () => { counter.textContent = `${idea.value.length} / 2000 characters`; };
  idea.addEventListener('input', update); update();
}
if (fileInput) fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileMessage.textContent = file && file.size > 3*1024*1024
    ? 'The file is too large. Choose one under 3 MB.'
    : 'Example: a PDF, PowerPoint, Word file, Excel file or image.';
});
if (form) form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = document.querySelector('#entry-error');
  const button = form.querySelector('button[type="submit"]');
  if (fileInput.files[0]?.size > 3*1024*1024) {
    error.textContent = 'Choose a file under 3 MB.'; return;
  }
  error.textContent = ''; button.disabled = true; button.textContent = 'Working…';
  try {
    const response = await fetch('/.netlify/functions/entry', { method:'POST', body: new FormData(form) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to receive your entry. Try again.');
    window.location.assign(`/result.html?ref=${encodeURIComponent(result.id)}`);
  } catch (e) {
    error.textContent = e.message || 'Please try again.';
    button.disabled = false; button.textContent = 'Enter my idea →';
  }
});
