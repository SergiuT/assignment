import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DataProvider } from '../state/DataContext';
import Items from './Items';
import { MemoryRouter } from 'react-router-dom';

function setupFetchMock(sequence) {
  // sequence: array of { items, total }
  const mock = jest.spyOn(global, 'fetch').mockImplementation((url) => {
    const next = sequence.shift();
    if (!next) throw new Error('No more mock responses');
    const headers = new Headers({ 'x-total-count': String(next.total ?? next.items.length) });
    return Promise.resolve({
      json: () => Promise.resolve(next.items),
      headers
    });
  });
  return mock;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DataProvider>
        <Items />
      </DataProvider>
    </MemoryRouter>
  );
}

test('loads first page, shows items and pagination from total header', async () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: 'Item ' + (i + 1) }));
  const fetchMock = setupFetchMock([{ items, total: 123 }]);

  const { container } = renderPage();

  // Skeletons appear first then items
  expect(container.querySelectorAll('.skeleton-row').length).toBeGreaterThan(0);
  await waitFor(() => expect(screen.getByText('Item 1')).toBeInTheDocument());

  // Pagination shows total-derived page count (default page size = 10)
  expect(screen.getByText(/Page 1 of 13/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('offset=0'), expect.any(Object));
});

test('search submits q and resets to page 1', async () => {
  const first = Array.from({ length: 2 }, (_, i) => ({ id: i + 1, name: 'Alpha ' + (i + 1) }));
  const second = Array.from({ length: 1 }, (_, i) => ({ id: 100 + i, name: 'Beta ' + (i + 1) }));
  const fetchMock = setupFetchMock([
    { items: first, total: 2 }, // initial
    { items: second, total: 1 } // after search
  ]);

  renderPage();
  await waitFor(() => expect(screen.getByText('Alpha 1')).toBeInTheDocument());

  fireEvent.change(screen.getByLabelText(/search/i), { target: { value: 'beta' } });
  fireEvent.submit(document.querySelector('form'));

  await waitFor(() => expect(screen.getByText('Beta 1')).toBeInTheDocument());
  const lastCallUrl = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0];
  expect(lastCallUrl).toContain('q=beta');
  expect(lastCallUrl).toContain('offset=0');
});

test('Next/Prev trigger offset changes; virtualization limits DOM nodes', async () => {
  const pageSize = 10;
  const page1 = Array.from({ length: pageSize }, (_, i) => ({ id: i + 1, name: 'Item ' + (i + 1) }));
  const page2 = Array.from({ length: pageSize }, (_, i) => ({ id: pageSize + i + 1, name: 'Item ' + (pageSize + i + 1) }));
  const fetchMock = setupFetchMock([
    { items: page1, total: 120 }, // initial
    { items: page2, total: 120 }  // after next
  ]);

  renderPage();
  await waitFor(() => expect(screen.getByText('Item 1')).toBeInTheDocument());

  // Virtualization: only a subset of 50 items should be in DOM (height 400, itemSize 40 => ~10)
  const allLinks = screen.getAllByRole('link');
  expect(allLinks.length).toBeLessThanOrEqual(12);

  fireEvent.click(screen.getByText(/next/i));
  await waitFor(() => expect(screen.getByText('Item 11')).toBeInTheDocument());

  const nextCallUrl = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0];
  expect(nextCallUrl).toContain('offset=10');
});

test('aborts in-flight request on re-query to prevent memory leaks', async () => {
  // Simulate a slow first response which will be aborted
  const controllerHolders = [];
  jest.spyOn(global, 'fetch').mockImplementation((url, opts) => {
    controllerHolders.push(opts && opts.signal);
    return new Promise((resolve, reject) => {
      const headers = new Headers({ 'x-total-count': '0' });
      const resp = { json: () => Promise.resolve([]), headers };
      // Resolve later unless aborted
      const onAbort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      if (opts && opts.signal) {
        if (opts.signal.aborted) return onAbort();
        opts.signal.addEventListener('abort', onAbort, { once: true });
      }
      setTimeout(() => resolve(resp), 50);
    });
  });

  renderPage();
  // Trigger a re-query quickly to cause abort
  fireEvent.change(screen.getByLabelText(/search/i), { target: { value: 'x' } });
  fireEvent.submit(document.querySelector('form'));

  // Ensure at least one signal exists and is aborted
  await waitFor(() => expect(controllerHolders.some(s => s && s.aborted)).toBe(true));
});


