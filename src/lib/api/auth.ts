import type { AuthUser, LoginResponse } from '../../types';
import { ACCESS_TOKEN_LIFETIME_MINS } from '../auth/config';
import { API_BASE_URL, httpClient } from './client';

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, expiresInMins: ACCESS_TOKEN_LIFETIME_MINS }),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new Error('Incorrect username or password.');
    }
    throw new Error('Sign-in failed. Please try again.');
  }
  return (await response.json()) as LoginResponse;
}

export function fetchCurrentUser(): Promise<AuthUser> {
  return httpClient.request<AuthUser>('/auth/me');
}
