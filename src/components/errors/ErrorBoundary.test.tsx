import { describe as vitestDescribe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { renderWithProviders } from '../../../test/providers';
import { describe, ErrorBoundary } from './ErrorBoundary';

vitestDescribe('describe', () => {
  it('extracts the message from an Error instance', () => {
    expect(describe(new Error('boom'))).toBe('boom');
  });

  it('passes a string error straight through', () => {
    expect(describe('something broke')).toBe('something broke');
  });

  it('returns null for anything else, so a non-string never gets rendered raw', () => {
    expect(describe({ weird: true })).toBeNull();
    expect(describe(42)).toBeNull();
    expect(describe(undefined)).toBeNull();
  });
});

vitestDescribe('ErrorBoundary', () => {
  it('renders its children when there is no route error', () => {
    const router = createMemoryRouter([{ path: '/', element: <ErrorBoundary>{'All good'}</ErrorBoundary> }]);
    render(<RouterProvider router={router} />);
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders the error message when a route throws during render', () => {
    // The error-branch renders PageLayout → AppBar → AccountMenu, which
    // touches theme/language/toast context — needs the full provider stack.
    const Throws = () => {
      throw new Error('projection failed');
    };
    const router = createMemoryRouter([{ path: '/', element: <Throws />, errorElement: <ErrorBoundary /> }]);
    renderWithProviders(<RouterProvider router={router} />);

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.getByText('projection failed')).toBeInTheDocument();
  });
});
