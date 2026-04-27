import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { AllLimitsTab } from '../src/popup/components/AllLimitsTab.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSendMessage = jest.fn<(...args: any[]) => Promise<any>>();

beforeAll(() => {
  (global as unknown as Record<string, unknown>).chrome = {
    runtime: { sendMessage: mockSendMessage },
  };
});

describe('AllLimitsTab', () => {
  const showMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches limits when activated', async () => {
    const limits = [{ hostname: 'example.com', timeLimit: 30, visitLimit: 5 }];
    mockSendMessage.mockResolvedValueOnce({ limits });

    render(<AllLimitsTab isActive={true} showMessage={showMessage} />);

    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });
    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'getAllLimits' });
  });

  it('does not fetch when inactive', () => {
    render(<AllLimitsTab isActive={false} showMessage={showMessage} />);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('shows empty state when no limits', async () => {
    mockSendMessage.mockResolvedValueOnce({ limits: [] });
    render(<AllLimitsTab isActive={true} showMessage={showMessage} />);

    await waitFor(() => {
      expect(screen.getByText(/no limits set yet/i)).toBeInTheDocument();
    });
  });

  it('filters limits by search text', async () => {
    const limits = [
      { hostname: 'example.com', timeLimit: 30 },
      { hostname: 'other.com', visitLimit: 5 },
    ];
    mockSendMessage.mockResolvedValueOnce({ limits });
    const user = userEvent.setup();

    render(<AllLimitsTab isActive={true} showMessage={showMessage} />);
    await waitFor(() => screen.getByText('example.com'));

    await user.type(screen.getByPlaceholderText(/search/i), 'example');

    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.queryByText('other.com')).not.toBeInTheDocument();
  });

  it('shows "no matching limits found" when search has no results', async () => {
    const limits = [{ hostname: 'example.com', timeLimit: 30 }];
    mockSendMessage.mockResolvedValueOnce({ limits });
    const user = userEvent.setup();

    render(<AllLimitsTab isActive={true} showMessage={showMessage} />);
    await waitFor(() => screen.getByText('example.com'));

    await user.type(screen.getByPlaceholderText(/search/i), 'zzz');

    expect(screen.getByText(/no matching limits found/i)).toBeInTheDocument();
  });

  it('removes card after successful delete', async () => {
    const limits = [{ hostname: 'example.com', timeLimit: 30 }];
    mockSendMessage
      .mockResolvedValueOnce({ limits })
      .mockResolvedValueOnce({ success: true });
    jest.spyOn(window, 'confirm').mockReturnValueOnce(true);
    const user = userEvent.setup();

    render(<AllLimitsTab isActive={true} showMessage={showMessage} />);
    await waitFor(() => screen.getByText('example.com'));

    await user.click(screen.getByRole('button', { name: /delete limit/i }));

    await waitFor(() => {
      expect(screen.queryByText('example.com')).not.toBeInTheDocument();
    });
    expect(showMessage).toHaveBeenCalledWith(expect.stringContaining('removed'));
  });

  it('shows error message when delete fails', async () => {
    const limits = [{ hostname: 'example.com', timeLimit: 30 }];
    mockSendMessage
      .mockResolvedValueOnce({ limits })
      .mockResolvedValueOnce({ success: false });
    jest.spyOn(window, 'confirm').mockReturnValueOnce(true);
    const user = userEvent.setup();

    render(<AllLimitsTab isActive={true} showMessage={showMessage} />);
    await waitFor(() => screen.getByText('example.com'));

    await user.click(screen.getByRole('button', { name: /delete limit/i }));

    await waitFor(() => {
      expect(showMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        expect.any(Number),
        true
      );
    });
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });
});
