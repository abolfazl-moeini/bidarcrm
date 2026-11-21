/**
 * Example Vanilla DOM Component & Event Listener Manager.
 * Demonstrates safe DOM manipulation, error state toggling, and clean teardown.
 */

function setupFilterForm(container, onFilter) {
  const form = document.createElement('form');
  form.className = 'my-filter-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'search';
  input.placeholder = 'Filter items...';

  const errorBox = document.createElement('div');
  errorBox.className = 'form-error';
  errorBox.style.display = 'none';

  form.appendChild(input);
  form.appendChild(errorBox);
  container.appendChild(form);

  const handleSubmit = (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) {
      errorBox.textContent = 'Search query cannot be empty.';
      errorBox.style.display = 'block';
      return;
    }
    errorBox.style.display = 'none';
    errorBox.textContent = '';
    onFilter(query);
  };

  form.addEventListener('submit', handleSubmit);

  // Return cleanup function to detach listener
  return () => {
    form.removeEventListener('submit', handleSubmit);
    container.innerHTML = '';
  };
}

describe('Vanilla DOM Interaction: setupFilterForm (Jest)', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders filter form and submits valid query', () => {
    const handleFilter = jest.fn();
    const cleanup = setupFilterForm(container, handleFilter);

    const input = container.querySelector('input[name="search"]');
    const form = container.querySelector('form');

    input.value = 'woocommerce';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(handleFilter).toHaveBeenCalledWith('woocommerce');
    expect(handleFilter).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('displays error when submitting empty input and does not trigger filter', () => {
    const handleFilter = jest.fn();
    const cleanup = setupFilterForm(container, handleFilter);

    const form = container.querySelector('form');
    const errorBox = container.querySelector('.form-error');

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(handleFilter).not.toHaveBeenCalled();
    expect(errorBox.style.display).toBe('block');
    expect(errorBox.textContent).toBe('Search query cannot be empty.');

    cleanup();
  });

  it('cleans up event listeners and DOM on teardown', () => {
    const handleFilter = jest.fn();
    const cleanup = setupFilterForm(container, handleFilter);

    cleanup();
    expect(container.innerHTML).toBe('');
  });
});
